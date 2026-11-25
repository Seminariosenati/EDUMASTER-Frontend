import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CompletionDonut, TrendChart } from "../components/charts";
import { NeuralNetworkCanvas, type NetState } from "../components/NeuralNetworkCanvas";
import { Badge, Panel, QueryState, Skeleton } from "../components/ui";
import {
  ActivityFeed, KpiStrip, PriorityList, RegionMap, SkillHeatmap, TaskManagerCompact, type ActivityItem, type SkillRow,
  type StripItem,
} from "../components/widgets";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtNumber, fmtPercent, timeAgo } from "../lib/format";
import { useRealtimeEvent } from "../lib/realtime";
import { STATE_LABEL, useTrainingLive } from "../lib/training";
import type { Architecture, Kpi, Recommendation, Summary, WeekPoint } from "../lib/types";

const PERIODS = [7, 30, 90];

interface LiveInference {
  student_code: string;
  course_title: string;
  model_version: number;
  completion_probability: number;
  risk_probability: number;
  mastery_level: string;
  skill_to_reinforce: string | null;
  activations: Record<string, number[]>;
  latency_ms: number;
}

const TRAINING_STATES: NetState[] = ["en_cola", "cargando_datos", "entrenando", "validando", "error"];

export function Dashboard() {
  const { me } = useAuth();
  const isStudent = me?.role === "estudiante";
  const [days, setDays] = useState(30);
  const [courseId, setCourseId] = useState("");
  const [cohort, setCohort] = useState("");
  const f = `course_id=${courseId}&cohort=${cohort}`;
  const courses = useQuery({ queryKey: ["courses", "filter"], queryFn: () => api<{ items: { id: string; code: string; title: string }[] }>("/courses?limit=200"), enabled: !isStudent });
  const summary = useQuery({ queryKey: ["summary", days, f], queryFn: () => api<Summary>(`/dashboard/summary?days=${days}&${f}`) });
  const progress = useQuery({ queryKey: ["progress", 12, f], queryFn: () => api<WeekPoint[]>(`/analytics/progress?weeks=12&${f}`) });
  const completion = useQuery({ queryKey: ["completion", f], queryFn: () => api<{ total: number; segments: { key: string; count: number; share: number }[] }>(`/analytics/completion?${f}`) });
  const regions = useQuery({ queryKey: ["regions", f], queryFn: () => api<{ region: string; students: number; active_30d: number; completion_rate: number }[]>(`/analytics/regions?${f}`) });
  const skills = useQuery({ queryKey: ["skills", f], queryFn: () => api<{ levels: string[]; skills: SkillRow[] }>(`/analytics/skill-mastery?${f}`) });
  const filtered = !!(courseId || cohort);
  const courseName = courses.data?.items.find((c) => c.id === courseId)?.title;
  const recs = useQuery({ queryKey: ["recommendations", "dash"], queryFn: () => api<Recommendation[]>("/recommendations?status=nueva&limit=40") });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => api<ActivityItem[]>("/activity?limit=6") });
  const arch = useQuery({ queryKey: ["architecture", "active"], queryFn: () => api<Architecture>("/ml/models/active/architecture"), retry: false });
  const training = useTrainingLive(arch.data?.training_active);

  const [live, setLive] = useState<LiveInference | null>(null);
  const [inferring, setInferring] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useRealtimeEvent(["model.inference.live"], (ev) => {
    setLive(ev.payload as unknown as LiveInference);
    setInferring(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setInferring(false), 2600);
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const netState: NetState = TRAINING_STATES.includes(training.state) ? training.state : inferring ? "inferencia" : "detenido";

  const strip = buildStrip(summary.data, progress.data);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centro de mando</h1>
          <p className="mt-1 text-sm text-muted">
            Últimos {days} días{courseName ? ` · ${courseName}` : ""}{cohort ? ` · cohorte ${cohort}` : ""} · actualizado {summary.data ? timeAgo(summary.data.generated_at) : "…"}
            {summary.data?.is_demo && <> · <b className="font-semibold text-ink">datos DEMO sintéticos</b></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isStudent && (
            <>
              <label className="sr-only" htmlFor="f-course">Curso</label>
              <select id="f-course" className="input h-[34px] w-auto max-w-[220px] py-0 text-xs" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Todos los cursos</option>
                {courses.data?.items.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
              </select>
              <label className="sr-only" htmlFor="f-cohort">Cohorte</label>
              <select id="f-cohort" className="input h-[34px] w-auto py-0 text-xs" value={cohort} onChange={(e) => setCohort(e.target.value)}>
                <option value="">Todas las cohortes</option><option value="2026-A">2026-A</option><option value="2026-B">2026-B</option>
              </select>
              {filtered && <button className="text-xs font-semibold text-violet hover:underline" onClick={() => { setCourseId(""); setCohort(""); }}>Limpiar</button>}
            </>
          )}
          <div role="group" aria-label="Periodo" className="flex overflow-hidden rounded-[10px] border border-line text-xs font-semibold">
            {PERIODS.map((d) => (
              <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}
                className={`px-3 py-2 ${days === d ? "bg-blue text-white" : "text-muted hover:text-ink"}`}>{d} d</button>
            ))}
          </div>
          <Link to="/ia" className="btn btn-ghost">Abrir laboratorio de IA →</Link>
        </div>
      </div>

      {strip ? <KpiStrip items={strip} /> : <Skeleton className="h-24" />}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          glow={netState !== "detenido"} title="Arquitectura de aprendizaje inteligente"
          subtitle={arch.data ? <span className="font-mono">edumaster-mtl v{arch.data.version} · {arch.data.total_params.toLocaleString("es-PE")} parámetros · 4 cabezas</span> : undefined}
          actions={
            <>
              <span className="flex gap-3 whitespace-nowrap text-xs text-muted">
                <span><span className="text-cyan">●</span> propagación</span>
                <span><span className="text-violet">●</span> gradientes</span>
              </span>
              <Badge tone={netState === "error" ? "danger" : netState === "detenido" ? "muted" : "violet"}>{STATE_LABEL[netState]}</Badge>
            </>
          }
        >
          {arch.isLoading ? <Skeleton className="h-72" /> : arch.data ? (
            <>
              <NeuralNetworkCanvas architecture={arch.data} state={netState} activations={live?.activations} height={300} compact />
              {training.state === "entrenando" ? (
                <p className="mt-2 border-t border-line pt-3 font-mono text-xs text-muted">época {training.epoch}/{training.epochs} · loss val {training.history.at(-1)?.val_loss.toFixed(4)}</p>
              ) : (
                <div className="mt-2 grid grid-cols-2 border-t border-line sm:grid-cols-4 [&>*]:border-line [&>*:not(:first-child)]:sm:border-l">
                  <Output label="Finalización en 28 días" value={live ? fmtPercent(live.completion_probability) : "—"} tone="text-teal" />
                  <Output label="Dominio estimado" value={live ? live.mastery_level : "—"} tone="text-violet capitalize" />
                  <Output label="Señal de riesgo" value={live ? fmtPercent(live.risk_probability) : "—"} tone="text-danger" />
                  <Output label="Reforzar primero" value={live?.skill_to_reinforce ?? "—"} tone="text-cyan" />
                </div>
              )}
              <p className="mt-1 font-mono text-[11px] text-muted">
                {live
                  ? `${live.student_code} · ${live.course_title} · nueva inferencia cada 5 s · ${live.latency_ms} ms`
                  : isStudent
                    ? "la inferencia en vivo es visible para docentes y personal; tu estimación está en IA · Red neuronal"
                    : "esperando la próxima inferencia del servidor…"}
              </p>
            </>
          ) : <p className="py-10 text-center text-sm text-muted">Aún no hay modelo publicado. Se entrenará con el dataset DEMO.</p>}
        </Panel>

        <Panel title="Progreso analítico" subtitle="Semanal · 12 semanas">
          <QueryState q={progress} skeleton="h-56">{(d) => <TrendChart data={d} height={isStudent ? 300 : 210} />}</QueryState>
          {!isStudent && (
            <div className="-mx-4 -mb-4 mt-3 border-t border-line p-4">
              <TaskManagerCompact />
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
        <Panel title="Estudiantes por región">
          <QueryState q={regions} skeleton="h-56" empty={(d) => !d.length}>{(d) => <RegionMap regions={d} limit={6} />}</QueryState>
        </Panel>
        <Panel title="Estado de matrículas" subtitle={completion.data ? `${fmtNumber(completion.data.total)} matrículas` : undefined}>
          <QueryState q={completion} skeleton="h-40" empty={(d) => !d.total}>{(d) => <CompletionDonut segments={d.segments.filter((x) => x.count > 0)} total={d.total} />}</QueryState>
        </Panel>
        <Panel title="Dominio de habilidades" subtitle="Validado por evaluaciones calificadas">
          <QueryState q={skills} skeleton="h-48" empty={(d) => !d.skills.length}>{(d) => <SkillHeatmap skills={d.skills} levels={d.levels} />}</QueryState>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel title={isStudent ? "Mis recomendaciones" : "Atención prioritaria"} subtitle={isStudent ? "Sugerencias de la IA para ti" : "Recomendaciones de la IA para revisar"}
          actions={<Link to="/recomendaciones" className="btn btn-ghost px-3 py-1.5 text-xs">Ver bandeja</Link>}>
          <QueryState q={recs} skeleton="h-48">{(d) => <PriorityList items={d} showStudent={!isStudent} />}</QueryState>
        </Panel>
        <Panel title="Actividad reciente">
          <QueryState q={activity} skeleton="h-48">{(d) => <ActivityFeed items={d} />}</QueryState>
        </Panel>
      </div>
    </div>
  );
}

const STRIP_STYLE: Record<string, { color: string; series?: (w: WeekPoint[]) => number[] }> = {
  active_students: { color: "var(--cyan)", series: (w) => w.map((x) => x.active_students) },
  courses: { color: "var(--ink)" },
  learning_hours: { color: "var(--violet)", series: (w) => w.map((x) => x.hours) },
  certificates: { color: "var(--teal)", series: (w) => cumulative(w.map((x) => x.completions)) },
  completion_rate: { color: "var(--cyan)", series: (w) => cumulative(w.map((x) => x.completions)) },
};

function cumulative(values: number[]) {
  let acc = 0;
  return values.map((v) => (acc += v));
}

function kpiValue(k: Kpi) {
  return k.unit === "%" ? fmtPercent(k.value) : `${fmtNumber(k.value)}${k.unit === "h" ? " h" : ""}`;
}

function buildStrip(summary?: Summary, weeks?: WeekPoint[]): StripItem[] | null {
  if (!summary) return null;
  const items: StripItem[] = summary.kpis.map((k) => {
    const st = STRIP_STYLE[k.key] ?? { color: "var(--ink)" };
    return {
      key: k.key, label: k.label, value: kpiValue(k), color: st.color,
      series: weeks && st.series ? st.series(weeks) : undefined,
      delta: k.change == null ? "sin periodo comparable" : `${k.change >= 0 ? "▲" : "▼"} ${fmtPercent(Math.abs(k.change))} vs anterior`,
      tone: k.change == null ? "flat" : k.change >= 0 ? "up" : "down",
      title: `Fuente: ${k.source} · ${new Date(k.as_of).toLocaleString("es-PE")}`,
    };
  });
  const m = summary.model;
  items.push({
    key: "model", label: "Modelo en producción", value: m ? fmtPercent(m.completion_roc_auc) : "—", color: "var(--violet)",
    delta: m ? `ROC-AUC v${m.version} · ${m.supera_baseline ? "supera base" : "bajo la base"}` : "sin modelo publicado",
    tone: m?.supera_baseline ? "up" : "flat",
    title: m ? `Medido sobre el conjunto de prueba ${m.dataset_demo ? "DEMO" : "institucional"}` : undefined,
  });
  return items;
}

function Output({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="min-w-0 py-3 sm:px-4 sm:first:pl-0">
      <p className="truncate text-xs text-muted">{label}</p>
      <p className={`mt-0.5 truncate text-lg font-bold ${tone}`} title={value}>{value}</p>
    </div>
  );
}
