import "server-only";

/**
 * Splitting a 16-bit mono WAV into short clips for Muse Voice Transcribe. Clips are cut at the
 * quietest moment near each target length, so words aren't chopped in half, and every clip
 * keeps its start time so a transcript line can be played back from the original recording.
 */

export interface WavInfo {
  rate: number;
  /** Byte offset where samples start, and how many 16-bit samples there are. */
  dataOffset: number;
  samples: number;
}

export function readWav(buf: Buffer): WavInfo | null {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
  if (buf.readUInt16LE(22) !== 1 || buf.readUInt16LE(34) !== 16) return null;
  const rate = buf.readUInt32LE(24);
  // Walk the chunks to find "data" (browsers write it at 36, but other encoders add chunks first).
  let at = 12;
  while (at + 8 <= buf.length) {
    const id = buf.toString("ascii", at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === "data") {
      const end = Math.min(buf.length, at + 8 + size);
      return { rate, dataOffset: at + 8, samples: Math.floor((end - at - 8) / 2) };
    }
    at += 8 + size + (size % 2);
  }
  return null;
}

export const wavSeconds = (info: WavInfo) => info.samples / info.rate;

/** A standalone WAV for samples [from, to). */
function clip(buf: Buffer, info: WavInfo, from: number, to: number): Buffer {
  const bytes = (to - from) * 2;
  const out = Buffer.alloc(44 + bytes);
  out.write("RIFF", 0, "ascii");
  out.writeUInt32LE(36 + bytes, 4);
  out.write("WAVE", 8, "ascii");
  out.write("fmt ", 12, "ascii");
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(info.rate, 24);
  out.writeUInt32LE(info.rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36, "ascii");
  out.writeUInt32LE(bytes, 40);
  buf.copy(out, 44, info.dataOffset + from * 2, info.dataOffset + to * 2);
  return out;
}

/** Sum of squares over [from, from+len): loudness of a short window. */
function energy(buf: Buffer, info: WavInfo, from: number, len: number): number {
  let e = 0;
  const end = Math.min(info.samples, from + len);
  for (let i = from; i < end; i += 4) {
    const v = buf.readInt16LE(info.dataOffset + i * 2);
    e += v * v;
  }
  return e;
}

/**
 * Clips of about `target` seconds (between 0.7× and 1.3× of it), each cut at the quietest
 * quarter second in that range. The last clip takes whatever is left.
 */
export function splitWav(buf: Buffer, info: WavInfo, target = 15): { start: number; end: number; wav: Buffer }[] {
  const out: { start: number; end: number; wav: Buffer }[] = [];
  const win = Math.round(info.rate / 4);
  let from = 0;
  while (from < info.samples) {
    const left = info.samples - from;
    let to = info.samples;
    if (left > target * 1.3 * info.rate) {
      const lo = from + Math.round(target * 0.7 * info.rate);
      const hi = from + Math.round(target * 1.3 * info.rate);
      let best = lo;
      let bestE = Infinity;
      for (let i = lo; i + win <= hi; i += Math.round(win / 2)) {
        const e = energy(buf, info, i, win);
        if (e < bestE) {
          bestE = e;
          best = i + Math.round(win / 2);
        }
      }
      to = best;
    }
    out.push({ start: from / info.rate, end: to / info.rate, wav: clip(buf, info, from, to) });
    from = to;
  }
  return out;
}
