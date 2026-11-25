import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Download, Globe2, Grid3x3, PieChart, RefreshCw } from "lucide-react";
import { useState } from "react";
import { CompletionDonut, TrendChart } from "../components/charts";
import { Note, PageHeader, Panel, QueryState } from "../components/ui";
import { REC_TYPES, RecommendationTable, SkillHeatmap, type SkillRow } from "../components/widgets";
import { api, download } from "../lib/api";
import { STAFF, useAuth } from "../lib/auth";
import { fmtNumber, fmtPercent } from "../lib/format";
import type { Recommendation, WeekPoint } from "../lib/types";

export function Analytics() {
  const { can } = useAuth();
  const [courseId, setCourseId] = useState("");
  const [cohort, setCohort] = useState("");
  const [source, setSource] = useState<"validated" | "estimated_ia">("validated");
  const qs = `course_id=${courseId}&cohort=${cohort}`;
  const courses = useQuery({ queryKey: ["courses", "all"], queryFn: () => api<{ items: { id: string; code: string; title: string }[] }>("/courses?limit=200") });
  const progress = useQuery({ queryKey: ["progress", 12, qs], queryFn: () => api<WeekPoint[]>(`/analytics/progress?weeks=12&${qs}`) });
  const completion = useQuery({ queryKey: ["completion", qs], queryFn: () => api<{ total: number; segments: { key: string; count: number; share: number }[] }>(`/analytics/completion?${qs}`) });
  const regions = useQuery({ queryKey: ["regions", qs], queryFn: () => api<{ region: string; students: number; active_30d: number; completion_rate: number }[]>(`/analytics/regions?${qs}`) });
  const skills = useQuery({ queryKey: ["skills", qs], queryFn: () => api<{ levels: string[]; skills: SkillRow[]; note: string }>(`/analytics/skill-mastery?${qs}`) });
  const canExport = can(...STAFF, "docente");

  return (
    <div className="space-y-4">
      <PageHeader title="Análisis educativo" subtitle="Participación, progreso, finalización y dominio según permisos"
        actions={canExport && (
          <>
            <button className="btn btn-ghost" onClick={() => download("/analytics/export?kind=progress", "edumaster-progreso.csv")}><Download size={15} /> Progreso CSV</button>
            <button className="btn btn-ghost" onClick={() => download("/analytics/export?kind=students", "edumaster-estudiantes.csv")}><Download size={15} /> Matrículas CSV</button>
          </>
        )} />
      <div className="flex flex-wrap gap-2">
        <select className="input max-w-xs" value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Curso">
          <option value="">Todos los cursos</option>
          {courses.data?.items.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
        </select>
        <select className="input max-w-[210px]" value={cohort} onChange={(e) => setCohort(e.target.value)} aria-label="Cohorte">
          <option value="">Todas las cohortes</option><option value="2026-A">2026-A</option><option value="2026-B">2026-B</option>
        </select>
      </div>

      <Panel icon={<BarChart3 size={16} />} title="Tendencia semanal">
        <QueryState q={progress} skeleton="h-64">{(d) => <TrendChart data={d} height={280} />}</QueryState>
        <QueryState q={progress}>
          {(d) => (
            <div className="mt-3 overflow-x-auto">
              <table className="data min-w-[560px]">
                <thead><tr><th>Semana</th><th className="text-right">Activos</th><th className="text-right">Eventos</th><th className="text-right">Actividades</th><th className="text-right">Horas</th><th className="text-right">Nota media</th></tr></thead>
                <tbody>{d.slice(-6).map((w) => <tr key={w.week_start}><td>{w.week_start}</td><td className="text-right">{fmtNumber(w.active_students)}</td><td className="text-right">{fmtNumber(w.events)}</td><td className="text-right">{fmtNumber(w.activities)}</td><td className="text-right">{w.hours}</td><td className="text-right">{w.avg_score ?? "—"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </QueryState>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon={<PieChart size={16} />} title="Estado de matrículas">
          <QueryState q={completion} empty={(d) => !d.total}>{(d) => <CompletionDonut segments={d.segments} total={d.total} />}</QueryState>
        </Panel>
        <Panel icon={<Globe2 size={16} />} title="Regiones">
          <QueryState q={regions} empty={(d) => !d.length}>
            {(d) => (
              <table className="data">
                <thead><tr><th>Región</th><th className="text-right">Estudiantes</th><th className="text-right">Activos 30d</th><th className="text-right">Finalización</th></tr></thead>
                <tbody>{d.map((r) => <tr key={r.region}><td>{r.region}</td><td className="text-right">{r.students}</td><td className="text-right">{r.active_30d}</td><td className="text-right">{fmtPercent(r.completion_rate)}</td></tr>)}</tbody>
              </table>
            )}
          </QueryState>
        </Panel>
      </div>

      <Panel icon={<Grid3x3 size={16} />} title="Dominio de habilidades"
        actions={
          <div className="flex rounded-lg border border-line p-0.5 text-xs">
            <button className={`rounded-md px-2 py-1 ${source === "validated" ? "bg-blue text-white" : "text-muted"}`} onClick={() => setSource("validated")}>Validado por docente</button>
            <button className={`rounded-md px-2 py-1 ${source === "estimated_ia" ? "bg-violet text-white" : "text-muted"}`} onClick={() => setSource("estimated_ia")}>Estimación IA</button>
          </div>
        }>
        <QueryState q={skills} empty={(d) => !d.skills.length}>
          {(d) => (
            <>
              <SkillHeatmap skills={d.skills} levels={d.levels} source={source} />
              <div className="mt-3"><Note>{d.note}</Note></div>
            </>
          )}
        </QueryState>
      </Panel>
    </div>
  );
}

const STATUS_TABS = [
  { key: "nueva", label: "Nuevas" },
  { key: "aceptada", label: "Aceptadas" },
  { key: "descartada", label: "Descartadas" },
  { key: "completada", label: "Completadas" },
  { key: "expirada", label: "Expiradas" },
  { key: "", label: "Todas" },
];

export function Recommendations() {
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState("nueva");
  const [type, setType] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["recommendations", "all"], queryFn: () => api<Recommendation[]>("/recommendations?limit=1000") });
  const [notice, setNotice] = useState<string | null>(null);
  const staffView = can(...STAFF, "docente", "ml_engineer");
  const metrics = useQuery({
    queryKey: ["recommendations", "metrics"],
    queryFn: () => api<{ total: number; revisadas: number; tasa_aceptacion: number | null; tasa_utilidad: number | null; valoradas: number; expiradas: number; expira_en_dias: number }>("/recommendations/metrics"),
    enabled: staffView,
  });
  const gen = useMutation({
    mutationFn: () => api<{ students: number; created: number }>("/recommendations/generate", { method: "POST", json: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations"] }),
  });
  const all = q.data ?? [];
  const byStatus = all.filter((r) => !status || r.status === status);
  const shown = byStatus.filter((r) => !type || r.type === type);
  const countStatus = (k: string) => all.filter((r) => !k || r.status === k).length;
  const countType = (k: string) => byStatus.filter((r) => r.type === k).length;
  return (
    <div className="space-y-4">
      <PageHeader title="Recomendaciones de IA" subtitle="Modelo vigente + reglas del catálogo. Siempre revisables por el docente; nunca sancionan."
        actions={can(...STAFF, "docente", "ml_engineer") && (
          <button className="btn btn-primary" disabled={gen.isPending} onClick={() => gen.mutate()}><RefreshCw size={15} className={gen.isPending ? "animate-spin" : ""} /> Generar con el modelo vigente</button>
        )} />
      {gen.data && <p role="status" className="text-sm text-teal">Se evaluaron {gen.data.students} estudiantes y se crearon {gen.data.created} recomendaciones nuevas.</p>}
      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-[10px] border border-teal/40 bg-teal/10 px-3 py-2 text-sm">
          <span className="font-semibold text-teal">Acción realizada:</span> {notice}
          <button className="ml-auto text-xs text-muted hover:text-ink" onClick={() => setNotice(null)}>Cerrar</button>
        </p>
      )}
      {staffView && metrics.data && (
        <section className="panel grid grid-cols-2 gap-px overflow-hidden !bg-line md:grid-cols-4" aria-label="Métricas de recomendaciones">
          <Metric label="Tasa de aceptación" value={fmtPercent(metrics.data.tasa_aceptacion)} sub={`${metrics.data.revisadas} revisadas`} tone="text-teal" />
          <Metric label="Marcadas como útiles" value={fmtPercent(metrics.data.tasa_utilidad)} sub={`${metrics.data.valoradas} valoradas`} tone="text-violet" />
          <Metric label="Total generadas" value={String(metrics.data.total)} sub="por el modelo vigente" tone="text-ink" />
          <Metric label="Expiradas" value={String(metrics.data.expiradas)} sub={`sin revisar en ${metrics.data.expira_en_dias} días`} tone="text-muted" />
        </section>
      )}
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4">
          <div role="tablist" aria-label="Estado" className="-mb-px flex flex-wrap">
            {STATUS_TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={status === t.key} onClick={() => setStatus(t.key)}
                className={`border-b-2 px-3.5 py-3 text-sm font-semibold transition ${status === t.key ? "border-blue text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                {t.label} <span className="ml-1 font-medium text-muted">{countStatus(t.key)}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap gap-1.5 py-2" role="group" aria-label="Tipo">
            {REC_TYPES.map((t) => (
              <button key={t.key} aria-pressed={type === t.key} onClick={() => setType(type === t.key ? null : t.key)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${type === t.key ? "border-violet/50 bg-violet/15 text-violet" : "border-line text-muted hover:text-ink"}`}>
                {t.label} {countType(t.key)}
              </button>
            ))}
          </div>
        </div>
        <QueryState q={q} skeleton="h-64">{() => <RecommendationTable items={shown} showStudent={me?.role !== "estudiante"} onAction={(m) => { setNotice(m); metrics.refetch(); }} />}</QueryState>
      </section>
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </div>
  );
}
