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
                  style={{ background: `rgba(${source === "validated" ? "32,200,245" : "139,77,255"},${0.08 + c.share * 1.6})` }}>
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

const REGION_POS: Record<string, [number, number]> = {
  Loreto: [62, 14], Piura: [14, 22], Lambayeque: [20, 36], "La Libertad": [28, 48], Lima: [38, 66], "Junín": [52, 60],
  Cusco: [66, 76], Arequipa: [58, 90],
};

export function RegionMap({ regions }: { regions: { region: string; students: number; active_30d: number; completion_rate: number }[] }) {
  const max = Math.max(...regions.map((r) => r.students), 1);
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative aspect-[4/5] max-h-64 rounded-xl border border-line bg-[radial-gradient(circle_at_50%_40%,rgba(8,127,229,0.18),transparent_70%)]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d="M14 18 L40 6 L72 8 L84 26 L76 44 L80 64 L74 84 L60 96 L44 84 L30 70 L22 52 L12 36 Z" fill="rgba(13,43,82,0.7)" stroke="rgba(32,130,230,0.5)" strokeWidth="0.6" />
        </svg>
        {regions.map((r) => {
          const pos = REGION_POS[r.region] ?? [50, 50];
          const size = 10 + (r.students / max) * 26;
          return (
            <div key={r.region} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${pos[0]}%`, top: `${pos[1]}%` }}>
              <div className="mx-auto rounded-full bg-cyan/40 shadow-[0_0_14px_#20C8F5]" style={{ width: size, height: size }} title={`${r.region}: ${r.students} estudiantes`} />
              <span className="mt-0.5 block whitespace-nowrap text-[10px] text-ink">{r.region}</span>
            </div>
          );
        })}
      </div>
      <ul className="space-y-2 text-sm">
        {regions.map((r) => (
          <li key={r.region}>
            <div className="flex justify-between text-xs">
              <span>{r.region}</span>
              <span className="tabular-nums text-muted">{fmtNumber(r.students)} · activos {fmtNumber(r.active_30d)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-white/5">
              <div className="h-full rounded-full bg-gradient-to-r from-blue to-cyan" style={{ width: `${(r.students / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const REC_ICON: Record<string, string> = { acompanamiento: "text-danger", completar: "text-teal", ruta: "text-cyan", refuerzo: "text-violet" };

export function RecommendationList({ items, compact, showStudent }: { items: Recommendation[]; compact?: boolean; showStudent?: boolean }) {
  const qc = useQueryClient();
  const fb = useMutation({
    mutationFn: ({ id, status, useful }: { id: string; status?: string; useful?: boolean }) =>
      api(`/recommendations/${id}/feedback`, { method: "POST", json: { status, useful } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations"] }),
  });
  if (!items.length) return <EmptyState message="No hay recomendaciones vigentes" icon={<Sparkles size={22} />} />;
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.id} className="rounded-lg border border-line bg-white/[0.02] p-2.5">
          <div className="flex items-start gap-2">
            <Sparkles size={15} className={`mt-0.5 shrink-0 ${REC_ICON[r.type] ?? "text-cyan"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.title}</p>
              {showStudent && <p className="text-[11px] text-cyan">{r.student.full_name}</p>}
              {!compact && <p className="mt-0.5 text-xs text-muted">{r.rationale}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge tone={r.status === "nueva" ? "blue" : r.status === "descartada" ? "muted" : "teal"}>{r.status}</Badge>
                <Badge tone="muted">impacto {r.impact}</Badge>
                {r.skill && <Badge tone="violet">{r.skill.name}</Badge>}
              </div>
            </div>
          </div>
          {!compact && r.status === "nueva" && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button className="btn btn-primary px-2 py-1 text-xs" onClick={() => fb.mutate({ id: r.id, status: "aceptada" })}><CheckCircle2 size={13} /> Aceptar</button>
              <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => fb.mutate({ id: r.id, status: "descartada" })}><X size={13} /> Descartar</button>
              <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => fb.mutate({ id: r.id, useful: true })} title="Útil"><ThumbsUp size={13} /></button>
              <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => fb.mutate({ id: r.id, useful: false })} title="No útil"><ThumbsDown size={13} /></button>
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
      {items.map((a) => {
        const d = describe(a);
        return (
          <li key={a.id} className="flex items-start gap-2 text-sm">
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
                    <div className="h-1.5 rounded-full bg-white/5">
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
          <div key={i} className="flex h-8 flex-1 flex-col justify-end rounded bg-white/5" title={`Núcleo ${i + 1}: ${c.toFixed(0)}%`}>
            <div className="rounded bg-cyan/60" style={{ height: `${Math.max(c, 3)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone = "text-cyan" }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.02] p-2">
      <p className="text-muted">{label}</p>
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
      <p className="truncate text-[10px] text-muted">{sub}</p>
    </div>
  );
}
