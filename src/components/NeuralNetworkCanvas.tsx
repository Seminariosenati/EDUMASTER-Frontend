import { useEffect, useMemo, useRef, useState } from "react";
import type { Architecture } from "../lib/types";

export type NetState = "detenido" | "en_cola" | "cargando_datos" | "entrenando" | "validando" | "publicado" | "inferencia" | "error";

interface Props {
  architecture: Architecture;
  state: NetState;
  activations?: Record<string, number[]>;
  paused?: boolean;
  speed?: number;
  height?: number;
  selected?: string | null;
  onSelect?: (layer: string) => void;
  compact?: boolean;
}

interface Node {
  x: number;
  y: number;
  layer: string;
  index: number;
  glow: number;
}
interface Column {
  name: string;
  label: string;
  nodes: Node[];
  hidden: number;
  x: number;
}
interface Edge {
  from: Node;
  to: Node;
  stage: number;
}
interface Particle {
  edge: Edge;
  t: number;
  dir: 1 | -1;
}

const MAX_NODES = 9;
const HEADS = ["Finalización", "Dominio", "Riesgo", "Recomendación"];
const COLORS = { forward: "#20C8F5", backward: "#8B4DFF", validate: "#00BFA6", error: "#FF5C7A" };

function sampleIndices(total: number, max: number) {
  if (total <= max) return Array.from({ length: total }, (_, i) => i);
  return Array.from({ length: max }, (_, i) => Math.round((i * (total - 1)) / (max - 1)));
}

function buildLayout(arch: Architecture, w: number, h: number) {
  const layers = Object.fromEntries(arch.layers.map((l) => [l.name, l]));
  const dense = arch.layers.filter((l) => l.group === "oculta");
  const pad = 52;
  const nCols = dense.length + 3;
  const colX = (i: number) => pad + ((w - 2 * pad) * i) / (nCols - 1);
  const topH = h * 0.66;
  const columns: Column[] = [];
  const place = (name: string, label: string, total: number, x: number, y0: number, y1: number): Column => {
    const idx = sampleIndices(total, MAX_NODES);
    const step = idx.length > 1 ? (y1 - y0) / (idx.length - 1) : 0;
    const nodes = idx.map((index, i) => ({ x, y: idx.length > 1 ? y0 + step * i : (y0 + y1) / 2, layer: name, index, glow: 0 }));
    return { name, label, nodes, hidden: total - idx.length, x };
  };
  const cfg = arch.config;
  const entrada = place("entrada", "Entrada", layers.entrada.neurons, colX(0), 26, topH - 26);
  const seq = place("secuencia", `Secuencia · ${cfg.seq_len} sem.`, cfg.seq_len, colX(0), topH + 10, h - 30);
  columns.push(entrada, seq);
  const denseCols = dense.map((l, i) => place(l.name, l.name.replace("_", " "), l.neurons, colX(i + 1), 26, topH - 26));
  columns.push(...denseCols);
  const gruX = denseCols.length ? (denseCols[0].x + denseCols[denseCols.length - 1].x) / 2 : colX(1);
  const gru = place("gru", "GRU temporal", layers.gru.neurons, gruX, topH + 10, h - 30);
  const fusion = place("fusion", "Fusión", layers.fusion.neurons, colX(nCols - 2), 22, h - 44);
  const heads: Column = {
    name: "salida", label: "Salidas", hidden: 0, x: colX(nCols - 1),
    nodes: HEADS.map((_, i) => ({ x: colX(nCols - 1), y: 40 + ((h - 80) * i) / 3, layer: "salida", index: i, glow: 0 })),
  };
  columns.push(gru, fusion, heads);

  const edges: Edge[] = [];
  const connect = (a: Column, b: Column, stage: number) => {
    for (const from of a.nodes) for (const to of b.nodes) edges.push({ from, to, stage });
  };
  const chain = [entrada, ...denseCols];
  chain.forEach((c, i) => i < chain.length - 1 && connect(c, chain[i + 1], i));
  connect(chain[chain.length - 1], fusion, chain.length - 1);
  connect(seq, gru, 0);
  connect(gru, fusion, chain.length - 1);
  connect(fusion, heads, chain.length);
  return { columns, edges, maxStage: chain.length };
}

export function NeuralNetworkCanvas({
  architecture, state, activations, paused = false, speed = 1, height = 340, selected, onSelect, compact,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(600);
  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const layout = useMemo(() => buildLayout(architecture, width, height), [architecture, width, height]);
  const stateRef = useRef({ state, paused, speed, activations, selected });
  stateRef.current = { state, paused, speed, activations, selected };

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !canvas.current) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.current.width = width * dpr;
    canvas.current.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { columns, edges, maxStage } = layout;
    const byStage = new Map<number, Edge[]>();
    for (const e of edges) byStage.set(e.stage, [...(byStage.get(e.stage) ?? []), e]);
    const outgoing = new Map<Node, Edge[]>();
    const incoming = new Map<Node, Edge[]>();
    for (const e of edges) {
      outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e]);
      incoming.set(e.to, [...(incoming.get(e.to) ?? []), e]);
    }
    let particles: Particle[] = [];
    let raf = 0;
    let last = 0;
    let spawnAcc = 0;
    let inferenceStarted = 0;

    const intensity = (node: Node) => {
      const acts = stateRef.current.activations;
      const key = node.layer === "salida" ? null : node.layer;
      const values = key ? acts?.[key] : undefined;
      if (!values?.length) return 0.35;
      const max = Math.max(...values.map(Math.abs), 1e-6);
      return 0.15 + 0.85 * (Math.abs(values[Math.min(node.index, values.length - 1)]) / max);
    };

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (ts - last < 33) return;
      const dt = Math.min((ts - last) / 1000, 0.1);
      last = ts;
      const s = stateRef.current;
      const animate = !s.paused && !reduced;
      const mode = s.state;
      const forward = mode === "entrenando" || mode === "validando" || mode === "inferencia" || mode === "cargando_datos";
      const color = mode === "error" ? COLORS.error : mode === "validando" ? COLORS.validate : COLORS.forward;

      if (animate && forward) {
        const rate = mode === "inferencia" ? 14 : mode === "cargando_datos" ? 3 : 9;
        spawnAcc += dt * rate * s.speed;
        if (mode === "inferencia" && !inferenceStarted) inferenceStarted = ts;
        while (spawnAcc >= 1) {
          spawnAcc -= 1;
          const first = [...(byStage.get(0) ?? [])];
          if (first.length) particles.push({ edge: first[Math.floor(Math.random() * first.length)], t: 0, dir: 1 });
          if (mode === "entrenando" && Math.random() < 0.45) {
            const lastStage = byStage.get(maxStage) ?? [];
            if (lastStage.length) particles.push({ edge: lastStage[Math.floor(Math.random() * lastStage.length)], t: 1, dir: -1 });
          }
        }
      }
      if (mode !== "inferencia") inferenceStarted = 0;

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      for (const e of edges) {
        const dim = s.selected && e.from.layer !== s.selected && e.to.layer !== s.selected;
        ctx.strokeStyle = dim ? "rgba(32,130,230,0.04)" : "rgba(32,130,230,0.13)";
        ctx.beginPath();
        ctx.moveTo(e.from.x, e.from.y);
        ctx.lineTo(e.to.x, e.to.y);
        ctx.stroke();
      }

      const next: Particle[] = [];
      for (const p of particles) {
        p.t += p.dir * dt * 1.6 * s.speed;
        const done = p.dir === 1 ? p.t >= 1 : p.t <= 0;
        const { from, to } = p.edge;
        const x = from.x + (to.x - from.x) * Math.min(Math.max(p.t, 0), 1);
        const y = from.y + (to.y - from.y) * Math.min(Math.max(p.t, 0), 1);
        ctx.fillStyle = p.dir === 1 ? color : COLORS.backward;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (done) {
          const target = p.dir === 1 ? to : from;
          target.glow = 1;
          const pool = p.dir === 1 ? outgoing.get(target) : incoming.get(target);
          if (pool?.length && Math.random() < 0.75) next.push({ edge: pool[Math.floor(Math.random() * pool.length)], t: p.dir === 1 ? 0 : 1, dir: p.dir });
        } else next.push(p);
      }
      particles = next.slice(-600);

      for (const col of columns) {
        const isSel = s.selected === col.name;
        for (const n of col.nodes) {
          n.glow = Math.max(0, n.glow - dt * 1.8);
          const base = intensity(n);
          const r = compact ? 4.5 : 6;
          const g = Math.min(1, base * 0.7 + n.glow);
          ctx.fillStyle = col.name === "salida" ? `rgba(0,191,166,${0.35 + g * 0.65})` : col.name === "gru" || col.name === "secuencia" ? `rgba(139,77,255,${0.3 + g * 0.7})` : `rgba(32,200,245,${0.25 + g * 0.75})`;
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 6 + g * 12;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          if (isSel) {
            ctx.strokeStyle = "#fff";
            ctx.beginPath();
            ctx.arc(n.x, n.y, r + 2.5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.fillStyle = isSel ? "#EAF3FF" : "#8BA7C9";
        ctx.font = `${compact ? 10 : 11}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        const bottom = Math.max(...col.nodes.map((n) => n.y));
        const top = Math.min(...col.nodes.map((n) => n.y));
        if (col.name === "salida") {
          ctx.textAlign = "right";
          col.nodes.forEach((n, i) => ctx.fillText(HEADS[i], n.x - 10, n.y - 9));
          ctx.textAlign = "center";
        } else if (col.name === "secuencia" || col.name === "gru" || col.name === "fusion") {
          ctx.fillText(col.label, col.x, bottom + 16);
        } else {
          ctx.fillText(col.label, col.x, top - 10);
        }
        const labelBelow = col.name === "gru" || col.name === "secuencia" || col.name === "fusion";
        if (col.hidden > 0 && !compact) ctx.fillText(`+${col.hidden}`, col.x, bottom + (labelBelow ? 28 : 16));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [layout, width, height, reduced, compact]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSelect) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best: { name: string; d: number } | null = null;
    for (const col of layout.columns) {
      for (const n of col.nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (!best || d < best.d) best = { name: col.name === "secuencia" ? "gru" : col.name === "salida" ? "cabeza_finalizacion" : col.name, d };
      }
    }
    if (best && best.d < 40) onSelect(best.name);
  };

  return (
    <div ref={wrap} className="relative w-full">
      <canvas
        ref={canvas}
        style={{ width: "100%", height }}
        onClick={onClick}
        className={onSelect ? "cursor-pointer" : ""}
        role="img"
        aria-label={`Red neuronal ${architecture.name}: ${architecture.layers.length} capas, ${architecture.total_params} parámetros, estado ${state}`}
      />
    </div>
  );
}
