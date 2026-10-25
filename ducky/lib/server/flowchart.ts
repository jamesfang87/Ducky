import "server-only";

/**
 * Flowchart primitive for visual explanations. Muse describes a graph (nodes, edges and the
 * order to walk it); the layout and the SVG are drawn here, so boxes never overlap, labels
 * stay inside the canvas and the picture is always valid. One frame per step of the walk.
 */

export interface FlowSpec {
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string; label?: string }[];
  walk: { node: string; caption: string }[];
}

const MAX_NODES = 8;
const W = 640;
const H = 360;
const FONT = 'font-family="Noto Sans, Arial, sans-serif"';
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plain = (s: string) => s.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ").filter(Boolean)) {
    if (line && (line + " " + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, Math.max(0, maxChars - 3)) + "...";
  }
  return lines;
}

/** Validates what the model sent. Returns null if it isn't a usable graph. */
export function parseFlowSpec(raw: unknown): FlowSpec | null {
  const o = (raw ?? {}) as { nodes?: unknown; edges?: unknown; walk?: unknown };
  if (!Array.isArray(o.nodes) || !Array.isArray(o.edges) || !Array.isArray(o.walk)) return null;
  const nodes = o.nodes
    .map((n) => n as { id?: unknown; label?: unknown })
    .filter((n) => typeof n.id === "string" && typeof n.label === "string" && plain(n.label))
    .slice(0, MAX_NODES)
    .map((n) => ({ id: n.id as string, label: plain(n.label as string).slice(0, 60) }));
  if (nodes.length < 2) return null;
  const ids = new Set(nodes.map((n) => n.id));
  const edges = o.edges
    .map((e) => e as { from?: unknown; to?: unknown; label?: unknown })
    .filter((e) => typeof e.from === "string" && typeof e.to === "string" && ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
    .map((e) => ({ from: e.from as string, to: e.to as string, label: typeof e.label === "string" ? plain(e.label).slice(0, 14) : undefined }));
  const walk = o.walk
    .map((w) => w as { node?: unknown; caption?: unknown })
    .filter((w) => typeof w.node === "string" && ids.has(w.node) && typeof w.caption === "string" && w.caption.trim())
    .slice(0, MAX_NODES + 2)
    .map((w) => ({ node: w.node as string, caption: (w.caption as string).trim().slice(0, 300) }));
  if (walk.length < 2 || !edges.length) return null;
  return { nodes, edges, walk };
}

/** Level of each node: longest path from a source, ignoring edges that would loop back. */
function levels(spec: FlowSpec): Map<string, number> {
  const level = new Map(spec.nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < spec.nodes.length; pass++) {
    let changed = false;
    for (const e of spec.edges) {
      const next = (level.get(e.from) ?? 0) + 1;
      if (next > (level.get(e.to) ?? 0) && next < spec.nodes.length) {
        level.set(e.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return level;
}

export function flowchartFrames(spec: FlowSpec): { svg: string; caption: string }[] {
  const level = levels(spec);
  const rows = new Map<number, string[]>();
  for (const n of spec.nodes) rows.set(level.get(n.id)!, [...(rows.get(level.get(n.id)!) ?? []), n.id]);
  const rowKeys = [...rows.keys()].sort((a, b) => a - b);
  const widest = Math.max(...rowKeys.map((k) => rows.get(k)!.length));
  const boxW = Math.min(168, Math.floor((W - 48) / widest) - 16);
  const boxH = 48;
  const gapY = rowKeys.length > 1 ? Math.min(90, (H - 64 - boxH) / (rowKeys.length - 1)) : 0;

  const pos = new Map<string, { x: number; y: number }>();
  rowKeys.forEach((k, r) => {
    const ids = rows.get(k)!;
    ids.forEach((id, i) => pos.set(id, { x: (W / (ids.length + 1)) * (i + 1), y: 34 + r * gapY + boxH / 2 }));
  });

  const arrows = spec.edges
    .map((e) => {
      const a = pos.get(e.from)!;
      const b = pos.get(e.to)!;
      const up = b.y <= a.y;
      // Edges that go back up or sideways leave from the side so they don't run through boxes.
      const x1 = up ? a.x + boxW / 2 : a.x;
      const y1 = up ? a.y : a.y + boxH / 2;
      const x2 = up ? b.x + boxW / 2 : b.x;
      const y2 = up ? b.y : b.y - boxH / 2 - 2;
      const bend = up ? `M${x1},${y1} C${x1 + 60},${y1} ${x2 + 60},${y2} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`;
      const label = e.label
        ? `<text x="${(x1 + x2) / 2 + (up ? 48 : 8)}" y="${(y1 + y2) / 2 + 4}" ${FONT} font-size="14" fill="#B54708">${esc(e.label)}</text>`
        : "";
      return `<path d="${bend}" fill="none" stroke="#6B7280" stroke-width="2" marker-end="url(#ah)"/>${label}`;
    })
    .join("");

  return spec.walk.map((w, step) => {
    const seen = new Set(spec.walk.slice(0, step).map((x) => x.node));
    const boxes = spec.nodes
      .map((n) => {
        const p = pos.get(n.id)!;
        const active = n.id === w.node;
        const fill = active ? "#FDE68A" : seen.has(n.id) ? "#D1FAE5" : "#FFFFFF";
        const stroke = active ? "#0B7A62" : "#C9CCC6";
        const lines = wrap(n.label, Math.max(8, Math.floor(boxW / 8)), 2);
        const ty = p.y - (lines.length - 1) * 8 + 5;
        return (
          `<rect x="${p.x - boxW / 2}" y="${p.y - boxH / 2}" width="${boxW}" height="${boxH}" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="${active ? 3 : 1.5}"/>` +
          `<text text-anchor="middle" ${FONT} font-size="14" fill="#1F2328">` +
          lines.map((l, i) => `<tspan x="${p.x}" y="${ty + i * 17}">${esc(l)}</tspan>`).join("") +
          `</text>`
        );
      })
      .join("");
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#FFFFFF"/>` +
      `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6B7280"/></marker></defs>` +
      arrows +
      boxes +
      `</svg>`;
    return { svg, caption: w.caption };
  });
}
