import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Award, BookCheck, BrainCircuit, CheckCircle2, ClipboardCheck, Cpu, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useState } from "react";
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

const REC_ICON: Record<string, string> = { acompanamiento: "text-danger", completar: "text-teal", ruta: "text-cyan", refuerzo: "text-violet" };

const TYPE_LABEL: Record<string, string> = { acompanamiento: "Acompañamiento", completar: "Completar", ruta: "Siguiente curso", refuerzo: "Refuerzo" };
const TYPE_BAR: Record<string, string> = { acompanamiento: "bg-danger", completar: "bg-teal", ruta: "bg-cyan", refuerzo: "bg-violet" };

export function RecommendationList({ items, compact, showStudent, grid }: { items: Recommendation[]; compact?: boolean; showStudent?: boolean; grid?: boolean }) {
  const qc = useQueryClient();
  const fb = useMutation({
    mutationFn: ({ id, status, useful }: { id: string; status?: string; useful?: boolean }) =>
      api(`/recommendations/${id}/feedback`, { method: "POST", json: { status, useful } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations"] }),
  });
  if (!items.length) return <EmptyState message="No hay recomendaciones vigentes" icon={<Sparkles size={22} />} />;
  return (
    <ul className={grid ? "grid gap-3 sm:grid-cols-2 2xl:grid-cols-3" : "space-y-2"}>
      {items.map((r) => (
        <li key={r.id} className={`relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface-2 ${grid ? "p-4 pl-5" : "p-2.5"}`}>
          {grid && <span className={`absolute inset-y-0 left-0 w-1 ${TYPE_BAR[r.type] ?? "bg-cyan"}`} aria-hidden />}
          <div className="flex items-start gap-2">
            <Sparkles size={15} className={`mt-0.5 shrink-0 ${REC_ICON[r.type] ?? "text-cyan"}`} />
            <div className="min-w-0 flex-1">
              {grid && <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{TYPE_LABEL[r.type] ?? r.type}</p>}
              <p className="text-sm font-semibold">{r.title}</p>
              {showStudent && <p className="text-xs text-cyan">{r.student.full_name}</p>}
            </div>
          </div>
          {!compact && <p className={`mt-2 text-xs leading-relaxed text-muted ${grid ? "flex-1" : ""}`}>{r.rationale}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={r.status === "nueva" ? "blue" : r.status === "descartada" ? "muted" : "teal"}>{r.status}</Badge>
            <Badge tone="muted">impacto {r.impact}</Badge>
            {r.skill && <Badge tone="violet">{r.skill.name}</Badge>}
            {r.useful != null && <Badge tone={r.useful ? "teal" : "muted"}>{r.useful ? "útil" : "no útil"}</Badge>}
          </div>
          {!compact && r.status === "nueva" && (
            <div className={`mt-3 flex flex-wrap gap-1.5 ${grid ? "border-t border-line pt-3" : ""}`}>
              <button className="btn btn-primary px-2.5 py-1.5 text-xs" onClick={() => fb.mutate({ id: r.id, status: "aceptada" })}><CheckCircle2 size={13} /> Aceptar</button>
              <button className="btn btn-ghost px-2.5 py-1.5 text-xs" onClick={() => fb.mutate({ id: r.id, status: "descartada" })}><X size={13} /> Descartar</button>
              <span className="ml-auto flex gap-1.5">
                <button className="btn btn-ghost px-2 py-1.5 text-xs" onClick={() => fb.mutate({ id: r.id, useful: true })} aria-label="Marcar como útil" title="Útil"><ThumbsUp size={13} /></button>
                <button className="btn btn-ghost px-2 py-1.5 text-xs" onClick={() => fb.mutate({ id: r.id, useful: false })} aria-label="Marcar como no útil" title="No útil"><ThumbsDown size={13} /></button>
              </span>
            </div>
          )}
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
    <ul className="space-y-2">
      {items.map((a, i) => {
        const d = describe(a);
        return (
          <li key={a.id} className={`flex items-start gap-2 rounded-[10px] text-sm ${i === 0 ? "border border-teal/40 bg-teal/10 px-2.5 py-2" : "px-2.5 py-1"}`}>
            <span className="mt-0.5">{d.icon}</span>
            <span className="min-w-0 flex-1">{d.text}</span>
            <span className="shrink-0 text-[11px] text-muted">{timeAgo(a.occurred_at)}</span>
          </li>
        );
      })}
    </ul>
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
