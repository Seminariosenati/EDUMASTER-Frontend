import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CompletionDonut, TrendChart } from "../components/charts";
import { NeuralNetworkCanvas, type NetState } from "../components/NeuralNetworkCanvas";
import { Badge, KpiCard, Panel, QueryState, Skeleton } from "../components/ui";
import {
  ActivityFeed, RecommendationList, RegionMap, SkillHeatmap, TaskManagerCompact, type ActivityItem, type SkillRow,
} from "../components/widgets";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtPercent, timeAgo } from "../lib/format";
import { useRealtimeEvent } from "../lib/realtime";
import { STATE_LABEL, useTrainingLive } from "../lib/training";
import type { Architecture, Recommendation, Summary, WeekPoint } from "../lib/types";

const ACCENTS = ["text-cyan", "text-ink", "text-violet", "text-teal", "text-cyan"];

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
  const summary = useQuery({ queryKey: ["summary", 30], queryFn: () => api<Summary>("/dashboard/summary") });
  const progress = useQuery({ queryKey: ["progress", 12], queryFn: () => api<WeekPoint[]>("/analytics/progress?weeks=12") });
  const completion = useQuery({ queryKey: ["completion"], queryFn: () => api<{ total: number; segments: { key: string; count: number; share: number }[] }>("/analytics/completion") });
  const regions = useQuery({ queryKey: ["regions"], queryFn: () => api<{ region: string; students: number; active_30d: number; completion_rate: number }[]>("/analytics/regions") });
  const skills = useQuery({ queryKey: ["skills"], queryFn: () => api<{ levels: string[]; skills: SkillRow[] }>("/analytics/skill-mastery") });
  const recs = useQuery({ queryKey: ["recommendations", "dash"], queryFn: () => api<Recommendation[]>("/recommendations?status=nueva&limit=4") });
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
  const model = summary.data?.model;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-violet">
            últimos 30 días · actualizado {summary.data ? timeAgo(summary.data.generated_at) : "…"}
            {summary.data?.is_demo && " · datos demo sintéticos"}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold">Centro de mando · Laboratorio en vivo</h1>
        </div>
        <Link to="/ia" className="btn btn-ghost">Abrir laboratorio de IA →</Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {summary.isLoading && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />)}
        {summary.data?.kpis.map((k, i) => <KpiCard key={k.key} kpi={k} accent={ACCENTS[i]} />)}
        {summary.data && (
          <div className="panel min-w-0 p-3" title={model ? `Medido sobre el conjunto de prueba ${model.dataset_demo ? "DEMO" : "institucional"}` : undefined}>
            <p className="truncate text-xs text-muted">Modelo en producción</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-violet">{model ? fmtPercent(model.completion_roc_auc) : "—"}</p>
            <p className={`mt-1 text-xs ${model?.supera_baseline ? "text-teal" : "text-muted"}`}>
              {model ? `ROC-AUC · v${model.version} · ${model.supera_baseline ? "supera baseline" : "no supera baseline"}` : "sin modelo publicado"}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Panel
          glow title="Arquitectura de aprendizaje inteligente"
          subtitle={arch.data ? <span className="font-mono">edumaster-mtl v{arch.data.version} · {arch.data.total_params.toLocaleString("es-PE")} parámetros · 4 cabezas</span> : undefined}
          actions={
            <>
              <span className="flex gap-3 text-[11px] text-muted">
                <span><i className="mr-1 inline-block h-[3px] w-3.5 bg-cyan align-middle" />propagación</span>
                <span><i className="mr-1 inline-block h-[3px] w-3.5 bg-violet align-middle" />gradientes</span>
              </span>
              <Badge tone={netState === "error" ? "danger" : netState === "detenido" ? "muted" : "violet"}>{STATE_LABEL[netState]}</Badge>
            </>
          }
        >
          {arch.isLoading ? <Skeleton className="h-72" /> : arch.data ? (
            <>
              <NeuralNetworkCanvas architecture={arch.data} state={netState} activations={live?.activations} height={300} compact />
              {training.state === "entrenando" ? (
                <p className="mt-1 font-mono text-xs text-muted">época {training.epoch}/{training.epochs} · loss val {training.history.at(-1)?.val_loss.toFixed(4)}</p>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Output label="Finalización 28 días" value={live ? fmtPercent(live.completion_probability) : "—"} tone="text-teal" />
                  <Output label="Dominio estimado" value={live ? live.mastery_level : "—"} tone="text-violet capitalize" />
                  <Output label="Señal de riesgo" value={live ? fmtPercent(live.risk_probability) : "—"} tone="text-danger" />
                  <Output label="Reforzar" value={live?.skill_to_reinforce ?? "—"} tone="text-cyan" />
                </div>
              )}
              <p className="mt-2.5 font-mono text-[11px] text-muted">
                {live
                  ? `ejemplo ${live.student_code} · ${live.course_title} · nueva inferencia cada 5 s · ${live.latency_ms} ms`
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
            <div className="mt-3 border-t border-line pt-3">
              <TaskManagerCompact />
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Mapa de progreso · Perú" subtitle="Estudiantes por región">
          <QueryState q={regions} skeleton="h-56" empty={(d) => !d.length}>{(d) => <RegionMap regions={d} limit={6} />}</QueryState>
        </Panel>
        <Panel title="Finalización de cursos">
          <QueryState q={completion} skeleton="h-40" empty={(d) => !d.total}>{(d) => <CompletionDonut segments={d.segments} total={d.total} />}</QueryState>
        </Panel>
        <Panel title="Dominio de habilidades" subtitle="Validado por evaluaciones calificadas">
          <QueryState q={skills} skeleton="h-48" empty={(d) => !d.skills.length}>{(d) => <SkillHeatmap skills={d.skills} levels={d.levels} />}</QueryState>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recomendaciones de IA" actions={<Link to="/recomendaciones" className="text-xs text-violet hover:underline">Ver todas</Link>}>
          <QueryState q={recs} skeleton="h-48">{(d) => <RecommendationList items={d} compact showStudent={!isStudent} />}</QueryState>
        </Panel>
        <Panel title="Actividad reciente">
          <QueryState q={activity} skeleton="h-48">{(d) => <ActivityFeed items={d} />}</QueryState>
        </Panel>
      </div>
    </div>
  );
}

function Output({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-line bg-surface-2 px-2.5 py-2">
      <p className="truncate text-[11px] text-muted">{label}</p>
      <p className={`mt-0.5 truncate text-base font-bold ${tone}`} title={value}>{value}</p>
    </div>
  );
}
