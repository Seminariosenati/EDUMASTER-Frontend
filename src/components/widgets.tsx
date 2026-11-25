import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Award, BookCheck, BrainCircuit, CheckCircle2, ClipboardCheck, Cpu, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { fmtBytes, fmtNumber, fmtPercent, timeAgo } from "../lib/format";
import { useRealtimeEvent } from "../lib/realtime";
import type { Architecture, Recommendation } from "../lib/types";
import { ResourceChart } from "./charts";
import { Badge, EmptyState } from "./ui";

export interface SkillRow {
  skill_id: string;
  name: string;
  validated: { level: string; count: number; share: number }[];
  estimated_ia: { level: string; count: number; share: number }[];
}

export function SkillHeatmap({ skills, levels, source = "validated" }: { skills: SkillRow[]; levels: string[]; source?: "validated" | "estimated_ia" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-1 text-[11px]">
        <thead>
          <tr>
            <th className="w-[34%] text-left font-medium text-muted">Competencia</th>
            {levels.map((l) => <th key={l} className="truncate font-medium capitalize text-muted" title={l}>{l.slice(0, 5)}.</th>)}
          </tr>
        </thead>
        <tbody>
          {skills.map((s) => (
            <tr key={s.skill_id}>
              <td className="truncate pr-1 text-ink" title={s.name}>{s.name}</td>
              {s[source].map((c) => (
                <td key={c.level} className="h-8 rounded-md text-center tabular-nums" title={`${c.count} estudiantes`}
                  style={{ background: `color-mix(in srgb, var(${source === "validated" ? "--primary" : "--cyan"}) ${Math.round(Math.min(95, 8 + c.share * 160))}%, transparent)`, color: c.share > 0.42 ? "#fff" : undefined }}>
                  {fmtPercent(c.share)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RegionMap({ regions, limit = 8 }: { regions: { region: string; students: number; active_30d: number; completion_rate: number }[]; limit?: number }) {
  const max = Math.max(...regions.map((r) => r.students), 1);
  return (
    <ul className="space-y-3 text-sm">
      {regions.slice(0, limit).map((r) => (
        <li key={r.region}>
          <div className="flex justify-between text-xs">
            <span>{r.region}</span>
            <span className="tabular-nums text-muted">{fmtNumber(r.students)} · activos {fmtNumber(r.active_30d)} · finaliza {fmtPercent(r.completion_rate)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-gradient-to-r from-blue to-cyan" style={{ width: `${(r.students / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}


export interface ActivityItem {
  id: string;
  type: string;
  occurred_at: string;
  student: string | null;
  course: string | null;
  payload: Record<string, unknown>;
}

function describe(a: ActivityItem) {
  switch (a.type) {
    case "course.completed": return { icon: <BookCheck size={15} className="text-teal" />, text: `${a.student} completó ${a.course}` };
    case "assessment.submitted": return { icon: <ClipboardCheck size={15} className="text-cyan" />, text: `${a.student} rindió una evaluación de ${a.course} (${a.payload.score ?? "—"})` };
    case "recommendation.created": return { icon: <Sparkles size={15} className="text-violet" />, text: `Nueva recomendación para ${a.student}: ${a.payload.title}` };
    case "notification.created": return { icon: <Award size={15} className="text-warn" />, text: String(a.payload.title ?? "Notificación") };
    case "model.training.completed": return { icon: <BrainCircuit size={15} className="text-violet" />, text: `Entrenamiento completado (v${a.payload.version})` };
    case "model.deployed": return { icon: <BrainCircuit size={15} className="text-teal" />, text: `Modelo v${a.payload.version} publicado` };
    default: return { icon: <Sparkles size={15} />, text: a.type };
  }
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (!items.length) return <EmptyState message="Sin actividad reciente" />;
  return (
    <ol className="relative">
      <span className="absolute bottom-3 left-[4px] top-3 w-px bg-line" aria-hidden />
      {items.map((a, i) => {
        const d = describe(a);
        return (
          <li key={a.id} className="relative grid grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-3 py-2 text-sm">
            <span className={`relative mt-1.5 h-[9px] w-[9px] rounded-full ${i === 0 ? "bg-teal shadow-[0_0_0_4px_color-mix(in_srgb,var(--teal)_22%,transparent)]" : "bg-line"}`} aria-hidden />
            <span className="min-w-0">{d.text}</span>
            <span className="shrink-0 text-xs text-muted">{timeAgo(a.occurred_at)}</span>
          </li>
        );
      })}
    </ol>
  );
}

const PRIORITY: Record<string, number> = { acompanamiento: 0, completar: 1, ruta: 2, refuerzo: 3 };
const TILE: Record<string, { cls: string; icon: ReactNode; label: string }> = {
  acompanamiento: { cls: "bg-danger/15 text-danger", icon: <AlertTriangle size={16} />, label: "Acompañamiento" },
  ruta: { cls: "bg-cyan/15 text-cyan", icon: <ArrowRight size={16} />, label: "Siguiente curso" },
  completar: { cls: "bg-teal/15 text-teal", icon: <CheckCircle2 size={16} />, label: "Completar" },
  refuerzo: { cls: "bg-violet/15 text-violet", icon: <Sparkles size={16} />, label: "Refuerzo" },
};

export function RecTile({ type }: { type: string }) {
  const t = TILE[type] ?? TILE.refuerzo;
  return <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${t.cls}`} title={t.label} aria-label={t.label}>{t.icon}</span>;
}

export const REC_TYPES = Object.entries(TILE).map(([key, t]) => ({ key, label: t.label }));

/** Las recomendaciones más urgentes primero: acompañamiento, luego por puntaje. */
export function PriorityList({ items, showStudent, limit = 3 }: { items: Recommendation[]; showStudent?: boolean; limit?: number }) {
  if (!items.length) return <EmptyState message="Nada pendiente de revisar" icon={<Sparkles size={22} />} />;
  const sorted = [...items].sort((a, b) => (PRIORITY[a.type] ?? 9) - (PRIORITY[b.type] ?? 9) || b.score - a.score).slice(0, limit);
  return (
    <ul className="divide-y divide-line">
      {sorted.map((r) => (
        <li key={r.id} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <RecTile type={r.type} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{r.title}</p>
            <p className="truncate text-xs text-muted">{showStudent ? `${r.student.full_name} · ` : ""}{r.rationale}</p>
          </div>
          <Badge tone={r.impact === "alto" ? "danger" : "muted"}>impacto {r.impact}</Badge>
        </li>
      ))}
    </ul>
  );
}

export function RecommendationTable({ items, showStudent, onAction }: { items: Recommendation[]; showStudent?: boolean; onAction?: (msg: string) => void }) {
  const qc = useQueryClient();
  const fb = useMutation({
    mutationFn: ({ id, status, useful }: { id: string; status?: string; useful?: boolean }) =>
      api<{ action: string | null }>(`/recommendations/${id}/feedback`, { method: "POST", json: { status, useful } }),
    onSuccess: (res) => {
      if (res.action) onAction?.(res.action);
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  if (!items.length) return <div className="p-6"><EmptyState message="No hay recomendaciones con estos filtros" icon={<Sparkles size={22} />} /></div>;
  return (
    <div className="overflow-x-auto">
      <table className="data min-w-[900px]">
        <thead>
          <tr>
            <th className="w-12" /><th>Recomendación</th>{showStudent && <th>Estudiante</th>}<th>Competencia</th><th>Impacto</th><th className="text-right">Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td className="!align-middle"><RecTile type={r.type} /></td>
              <td className="!align-middle">
                <p className="font-semibold">{r.title}</p>
                <p className="max-w-[68ch] text-xs text-muted">{r.rationale}</p>
              </td>
              {showStudent && <td className="!align-middle whitespace-nowrap">{r.student.full_name}</td>}
              <td className="!align-middle whitespace-nowrap">{r.skill && <Badge tone="violet">{r.skill.name}</Badge>}</td>
              <td className="!align-middle">
                <span className="flex flex-wrap gap-1">
                  <Badge tone={r.impact === "alto" ? "danger" : "muted"}>{r.impact}</Badge>
                  {r.useful != null && <Badge tone={r.useful ? "teal" : "muted"}>{r.useful ? "útil" : "no útil"}</Badge>}
                </span>
              </td>
              <td className="!align-middle text-right">
                {r.status === "nueva" ? (
                  <span className="inline-flex flex-nowrap justify-end gap-1.5 whitespace-nowrap">
                    <button className="btn btn-primary px-2.5 py-1.5 text-xs" disabled={fb.isPending} onClick={() => fb.mutate({ id: r.id, status: "aceptada" })}><CheckCircle2 size={13} /> Aceptar</button>
                    <button className="btn btn-ghost px-2.5 py-1.5 text-xs" disabled={fb.isPending} onClick={() => fb.mutate({ id: r.id, status: "descartada" })}><X size={13} /> Descartar</button>
                    <button className="btn btn-ghost px-2 py-1.5 text-xs" disabled={fb.isPending} onClick={() => fb.mutate({ id: r.id, useful: true })} aria-label="Marcar como útil" title="Útil"><ThumbsUp size={13} /></button>
                    <button className="btn btn-ghost px-2 py-1.5 text-xs" disabled={fb.isPending} onClick={() => fb.mutate({ id: r.id, useful: false })} aria-label="Marcar como no útil" title="No útil"><ThumbsDown size={13} /></button>
                  </span>
                ) : <Badge tone={r.status === "descartada" || r.status === "expirada" ? "muted" : "teal"}>{r.status}</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ArchitectureTable({ arch, compareTo, compact }: { arch: Architecture; compareTo?: Architecture; compact?: boolean }) {
  const prev = Object.fromEntries((compareTo?.layers ?? []).map((l) => [l.name, l]));
  return (
    <div className="overflow-x-auto">
      <table className={`data ${compact ? "" : "min-w-[640px]"}`}>
        <thead>
          <tr>
            <th>Capa</th>{!compact && <th>Tipo</th>}<th className="text-right">Entradas</th><th className="text-right">Neuronas</th>
            <th className="text-right">Parámetros</th><th className="text-right">Memoria</th>{!compact && <th>Proporción</th>}
          </tr>
        </thead>
        <tbody>
          {arch.layers.map((l) => {
            const heavy = l.name === arch.heaviest_dense_layer;
            const before = prev[l.name];
            return (
              <tr key={l.name} className={heavy ? "bg-violet/10" : ""}>
                <td className="font-medium">{l.name} {heavy && <Badge tone="violet">{compact ? "más pesada" : "densa más pesada"}</Badge>}</td>
                {!compact && <td className="text-muted">{l.type}</td>}
                <td className="text-right tabular-nums">{l.inputs}</td>
                <td className="text-right tabular-nums">{l.neurons}</td>
                <td className="text-right tabular-nums">
                  {fmtNumber(l.params)}
                  {before && before.params !== l.params && (
                    <span className={`ml-1 text-[10px] ${l.params > before.params ? "text-warn" : "text-teal"}`}>
                      ({l.params > before.params ? "+" : ""}{fmtNumber(l.params - before.params)})
                    </span>
                  )}
                </td>
                <td className="text-right tabular-nums">{fmtBytes(l.total_bytes)}</td>
                {!compact && (
                  <td className="w-40">
                    <div className="h-1.5 rounded-full bg-ink/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue to-violet" style={{ width: `${l.memory_share * 100}%` }} />
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={compact ? 3 : 4} className="pt-2 text-xs text-muted">{compact ? "Total" : `Lote de ${arch.batch_size} ejemplos · pesos + gradientes + estado de Adam + activaciones`}</td>
            <td className="pt-2 text-right font-semibold tabular-nums">{fmtNumber(arch.total_params)}</td>
            <td className="pt-2 text-right font-semibold tabular-nums">{fmtBytes(arch.total_bytes)}</td>
            {!compact && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

interface Resources {
  cpu_percent: number;
  cpu_count: number;
  cpu_per_core: number[];
  memory_total: number;
  memory_used: number;
  memory_percent: number;
  process_memory: number;
  process_cpu_percent: number;
  process_threads: number;
  training_active: boolean;
}

export function ResourceMonitor() {
  const [points, setPoints] = useState<{ t: string; cpu: number; mem: number }[]>([]);
  const [last, setLast] = useState<Resources | null>(null);
  useRealtimeEvent(["system.resources"], (ev) => {
    const r = ev.payload as unknown as Resources;
    setLast(r);
    setPoints((p) => [...p.slice(-59), { t: ev.occurred_at, cpu: r.cpu_percent, mem: r.memory_percent }]);
  });
  if (!last) return <EmptyState message="Esperando métricas del servidor…" icon={<Cpu size={22} />} />;
  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Stat label="CPU servidor" value={`${last.cpu_percent.toFixed(0)}%`} sub={`${last.cpu_count} núcleos`} />
        <Stat label="Memoria servidor" value={`${last.memory_percent.toFixed(0)}%`} sub={`${fmtBytes(last.memory_used)} / ${fmtBytes(last.memory_total)}`} />
        <Stat label="Proceso API" value={fmtBytes(last.process_memory)} sub={`CPU ${last.process_cpu_percent.toFixed(0)}% · ${last.process_threads} hilos`} />
        <Stat label="Entrenamiento" value={last.training_active ? "Activo" : "Inactivo"} sub="worker asíncrono" tone={last.training_active ? "text-violet" : "text-muted"} />
      </div>
      <ResourceChart points={points} />
      <div className="mt-2 flex gap-1" aria-label="Uso por núcleo">
        {last.cpu_per_core.map((c, i) => (
          <div key={i} className="flex h-8 flex-1 flex-col justify-end rounded bg-ink/5" title={`Núcleo ${i + 1}: ${c.toFixed(0)}%`}>
            <div className="rounded bg-cyan/60" style={{ height: `${Math.max(c, 3)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone = "text-cyan" }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink/[0.03] p-2">
      <p className="text-muted">{label}</p>
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
      <p className="truncate text-[10px] text-muted">{sub}</p>
    </div>
  );
}

export function TaskManagerCompact() {
  const [last, setLast] = useState<Resources | null>(null);
  useRealtimeEvent(["system.resources"], (ev) => setLast(ev.payload as unknown as Resources));
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">Administrador de tareas</h3>
        <span className="font-mono text-[11px] text-muted">
          {last ? `${last.cpu_count} núcleos · API ${fmtBytes(last.process_memory)}` : "esperando métricas…"}
        </span>
      </div>
      <div className="mt-2.5 flex h-20 items-end gap-2" role="img" aria-label={last ? `CPU por núcleo: ${last.cpu_per_core.map((c) => `${c.toFixed(0)}%`).join(", ")}` : "Sin métricas"}>
        {(last?.cpu_per_core ?? [0, 0, 0, 0]).map((c, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end overflow-hidden rounded-lg bg-surface-2" title={`Núcleo ${i + 1}: ${c.toFixed(0)}%`}>
            <div className="rounded-t-md bg-gradient-to-b from-cyan to-cyan/40 transition-[height] duration-700" style={{ height: `${Math.max(c, 4)}%` }} />
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-xs text-muted">
        Memoria del servidor · {last ? `${last.memory_percent.toFixed(0)}%` : "—"}
        {last?.training_active && <span className="ml-2 font-semibold text-violet">entrenando</span>}
      </p>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-gradient-to-r from-blue to-violet transition-[width] duration-700" style={{ width: `${last?.memory_percent ?? 0}%` }} />
      </div>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => `${(i * 64) / (values.length - 1)},${24 - ((v - min) / (max - min || 1)) * 20}`).join(" ");
  return (
    <svg viewBox="0 0 64 26" width="64" height="26" className="shrink-0" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts} />
    </svg>
  );
}

export interface StripItem {
  key: string;
  label: string;
  value: string;
  delta: string;
  tone: "up" | "down" | "flat";
  color: string;
  series?: number[];
  title?: string;
}

/** KPIs en una sola franja con divisores: lectura de un vistazo sin una fila de tarjetas idénticas. */
export function KpiStrip({ items }: { items: StripItem[] }) {
  return (
    <section className="panel grid grid-cols-2 gap-px overflow-hidden !bg-line md:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores principales">
      {items.map((k) => (
        <div key={k.key} title={k.title} className="flex min-w-0 flex-col gap-0.5 bg-surface p-4">
          <span className="truncate text-xs text-muted">{k.label}</span>
          <div className="flex items-end justify-between gap-2">
            <span className="whitespace-nowrap text-2xl font-bold tabular-nums tracking-tight" style={{ color: k.color }}>{k.value}</span>
            {k.series && <Sparkline values={k.series} color={k.color} />}
          </div>
          <span className={`truncate text-xs font-semibold ${k.tone === "up" ? "text-teal" : k.tone === "down" ? "text-danger" : "text-muted"}`}>{k.delta}</span>
        </div>
      ))}
    </section>
  );
}
