import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, BrainCircuit, Globe2, Grid3x3, PieChart, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { CompletionDonut, TrendChart } from "../components/charts";
import { NeuralNetworkCanvas } from "../components/NeuralNetworkCanvas";
import { Badge, KpiCard, Panel, QueryState, Skeleton } from "../components/ui";
import { ActivityFeed, RecommendationList, RegionMap, SkillHeatmap, type ActivityItem, type SkillRow } from "../components/widgets";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { STATE_LABEL, useTrainingLive } from "../lib/training";
import type { Architecture, Recommendation, Summary, WeekPoint } from "../lib/types";

const ACCENTS = ["text-cyan", "text-blue", "text-violet", "text-teal", "text-cyan"];

export function Dashboard() {
  const { me } = useAuth();
  const summary = useQuery({ queryKey: ["summary", 30], queryFn: () => api<Summary>("/dashboard/summary") });
  const progress = useQuery({ queryKey: ["progress", 12], queryFn: () => api<WeekPoint[]>("/analytics/progress?weeks=12") });
  const completion = useQuery({ queryKey: ["completion"], queryFn: () => api<{ total: number; segments: { key: string; count: number; share: number }[] }>("/analytics/completion") });
  const regions = useQuery({ queryKey: ["regions"], queryFn: () => api<{ region: string; students: number; active_30d: number; completion_rate: number }[]>("/analytics/regions") });
  const skills = useQuery({ queryKey: ["skills"], queryFn: () => api<{ levels: string[]; skills: SkillRow[] }>("/analytics/skill-mastery") });
  const recs = useQuery({ queryKey: ["recommendations", "dash"], queryFn: () => api<Recommendation[]>("/recommendations?status=nueva&limit=5") });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => api<ActivityItem[]>("/activity?limit=8") });
  const arch = useQuery({ queryKey: ["architecture", "active"], queryFn: () => api<Architecture>("/ml/models/active/architecture"), retry: false });
  const live = useTrainingLive(arch.data?.training_active);
  const netState = live.state === "publicado" ? "detenido" : live.state;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Hola, {me?.full_name.split(" ")[0]}</h1>
          <p className="text-sm text-muted">
            Últimos 30 días · actualizado {summary.data ? fmtDate(summary.data.generated_at) : "…"}
            {summary.data?.is_demo && " · datos DEMO sintéticos"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {summary.isLoading && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24" />)}
        {summary.data?.kpis.map((k, i) => <KpiCard key={k.key} kpi={k} accent={ACCENTS[i]} />)}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel
          glow className="xl:col-span-3" icon={<BrainCircuit size={16} />} title="Arquitectura de aprendizaje inteligente"
          subtitle={arch.data ? `${arch.data.name} · v${arch.data.version} · ${arch.data.total_params.toLocaleString("es-PE")} parámetros` : undefined}
          actions={<><Badge tone={netState === "error" ? "danger" : netState === "detenido" ? "muted" : "violet"}>{STATE_LABEL[netState]}</Badge><Link to="/ia" className="text-xs text-cyan hover:underline">Abrir laboratorio →</Link></>}
        >
          {arch.isLoading ? <Skeleton className="h-72" /> : arch.data ? (
            <>
              <NeuralNetworkCanvas architecture={arch.data} state={netState} height={290} compact />
              {live.state === "entrenando" && (
                <p className="mt-1 text-xs text-muted">Época {live.epoch}/{live.epochs} · loss val {live.history.at(-1)?.val_loss.toFixed(4)}</p>
              )}
            </>
          ) : <p className="py-10 text-center text-sm text-muted">Aún no hay modelo publicado. Se entrenará con el dataset DEMO.</p>}
        </Panel>
        <Panel className="xl:col-span-2" icon={<BarChart3 size={16} />} title="Progreso analítico" subtitle="Semanal · 12 semanas">
          <QueryState q={progress} skeleton="h-56">{(d) => <TrendChart data={d} />}</QueryState>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" icon={<Globe2 size={16} />} title="Mapa de progreso de aprendizaje" subtitle="Distribución agregada por región">
          <QueryState q={regions} skeleton="h-56" empty={(d) => !d.length}>{(d) => <RegionMap regions={d} />}</QueryState>
        </Panel>
        <Panel className="lg:col-span-2" icon={<PieChart size={16} />} title="Finalización de cursos">
          <QueryState q={completion} skeleton="h-40" empty={(d) => !d.total}>{(d) => <CompletionDonut segments={d.segments} total={d.total} />}</QueryState>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel icon={<Grid3x3 size={16} />} title="Dominio de habilidades · Mastery" subtitle="Validado por evaluaciones calificadas">
          <QueryState q={skills} skeleton="h-48" empty={(d) => !d.skills.length}>{(d) => <SkillHeatmap skills={d.skills} levels={d.levels} />}</QueryState>
        </Panel>
        <Panel icon={<Sparkles size={16} />} title="Recomendaciones de IA" actions={<Link to="/recomendaciones" className="text-xs text-cyan hover:underline">Ver todas</Link>}>
          <QueryState q={recs} skeleton="h-48">{(d) => <RecommendationList items={d} compact showStudent={me?.role !== "estudiante"} />}</QueryState>
        </Panel>
        <Panel icon={<Activity size={16} />} title="Actividad reciente">
          <QueryState q={activity} skeleton="h-48">{(d) => <ActivityFeed items={d} />}</QueryState>
        </Panel>
      </div>
    </div>
  );
}
