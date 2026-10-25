/**
 * Ducky Radio: a generative lofi track that follows the student's reasoning.
 *
 * - Every step explained correctly adds a layer (pads -> bass -> drums -> melody).
 * - A flagged misconception swaps the chords for an unresolved ii-V loop and closes the filter.
 * - Fixing it resolves back to the home chord. Finishing the problem lands on a held Cmaj9.
 *
 * Everything is synthesized with Web Audio (no audio files, nothing to download or license).
 */

const BPM = 72;
const BEAT = 60 / BPM;
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// Home progression in C: Fmaj7 - Em7 - Dm7 - Cmaj7.
const HOME = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
// Tension: Dm7b5 - G7b9 on repeat. It never lands on C.
const TENSE = [
  [50, 53, 56, 60],
  [55, 59, 62, 65],
  [50, 53, 56, 60],
  [55, 59, 62, 65],
];
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76]; // C major pentatonic, two octaves

export type RadioState = { progress: number; tension: boolean; done: boolean };

export class DuckyRadio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private filter!: BiquadFilterNode;
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  private state: RadioState = { progress: 0, tension: false, done: false };
  private finished = false;
  private noise!: AudioBuffer;

  get running() {
    return this.ctx !== null && this.timer !== null;
  }

  async start() {
    if (this.running) return;
    if (!this.ctx) this.build();
    await this.ctx!.resume();
    this.master.gain.cancelScheduledValues(this.ctx!.currentTime);
    this.master.gain.setTargetAtTime(0.5, this.ctx!.currentTime, 0.4);
    this.nextTime = this.ctx!.currentTime + 0.1;
    this.beat = 0;
    this.finished = false;
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  stop() {
    if (!this.ctx) return;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  set(next: RadioState) {
    const wasDone = this.state.done;
    this.state = next;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Tension closes the filter and dulls the room; resolving opens it back up.
    this.filter.frequency.setTargetAtTime(next.tension ? 650 : 900 + next.progress * 2600, t, 0.6);
    if (next.done && !wasDone && this.running) this.resolve();
    if (!next.done) this.finished = false;
  }

  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 900;
    this.filter.Q.value = 0.7;
    this.filter.connect(this.master);
    this.master.connect(ctx.destination);

    // Pre-rendered noise: used for hats, snares and vinyl crackle.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Constant vinyl crackle: sparse pops, not hiss.
    const crackle = ctx.createBuffer(1, len, ctx.sampleRate);
    const c = crackle.getChannelData(0);
    for (let i = 0; i < len; i++) c[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : 0;
    const src = ctx.createBufferSource();
    src.buffer = crackle;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.value = 0.09;
    src.connect(hp).connect(g).connect(this.master);
    src.start();
  }

  private schedule() {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + 0.35) {
      this.playBeat(this.beat, this.nextTime);
      // Light swing on the off-beat.
      this.nextTime += BEAT / 2;
      this.beat++;
    }
  }

  private playBeat(n: number, t: number) {
    if (this.finished) return;
    const { progress, tension } = this.state;
    const eighth = n % 8; // 8 eighths per bar, 4 bars per loop
    const bar = Math.floor(n / 8) % 4;
    const chord = (tension ? TENSE : HOME)[bar];
    const swing = eighth % 2 === 1 ? BEAT * 0.09 : 0;
    const when = t + swing;

    // Layer 0, always: soft electric-piano chords on 1 and the "and" of 3.
    if (eighth === 0 || eighth === 5) this.chord(chord, when, tension ? 0.05 : 0.07);

    // Layer 1, from 25%: bass on the root.
    if (progress >= 0.25 && (eighth === 0 || eighth === 6)) this.tone(midi(chord[0] - 24), when, BEAT * 1.6, 0.2, "sine");

    // Layer 2, from 50%: kick, snare, hats.
    if (progress >= 0.5) {
      if (eighth === 0 || eighth === 5) this.kick(when);
      if (eighth === 4) this.snare(when);
      this.hat(when, eighth % 2 === 0 ? 0.05 : 0.03);
    }

    // Layer 3, from 75%: a sparse melody over the chord. Silent while a misconception is open.
    if (progress >= 0.75 && !tension && (eighth === 2 || eighth === 7) && Math.random() < 0.7) {
      const note = SCALE[Math.floor(Math.random() * SCALE.length)];
      this.tone(midi(note), when, BEAT * 1.2, 0.07, "triangle");
    }
  }

  /** The tonic lands and rings out. */
  private resolve() {
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.05;
    this.finished = true;
    this.filter.frequency.setTargetAtTime(4200, t, 0.3);
    [48, 55, 59, 64, 67, 71].forEach((m, i) => this.tone(midi(m), t + i * 0.09, 6, 0.09, "sine"));
    // A little rising sparkle on top.
    [72, 76, 79, 83, 84].forEach((m, i) => this.tone(midi(m), t + 0.5 + i * 0.16, 2.4, 0.045, "triangle"));
    window.setTimeout(() => this.stop(), 7000);
  }

  private chord(notes: number[], t: number, vol: number) {
    notes.forEach((m, i) => this.tone(midi(m), t + i * 0.012, BEAT * 3, vol, "triangle", 0.35));
  }

  private tone(freq: number, t: number, dur: number, vol: number, type: OscillatorType, attack = 0.02) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o2.type = "sine";
    o.frequency.value = freq;
    o2.frequency.value = freq * 2.003; // slightly detuned octave: the "warped tape" shimmer
    const detune = this.state.tension ? (Math.random() - 0.5) * 18 : (Math.random() - 0.5) * 6;
    o.detune.value = detune;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o2.connect(g2).connect(g);
    g.connect(this.filter);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.1);
    o2.stop(t + dur + 0.1);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(this.filter);
    o.start(t);
    o.stop(t + 0.25);
  }

  private snare(t: number) {
    this.burst(t, 0.16, 0.12, 1800, "bandpass");
  }

  private hat(t: number, vol: number) {
    this.burst(t, 0.04, vol, 7000, "highpass");
  }

  private burst(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f).connect(g).connect(this.filter);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }
}
