import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Download, Globe2, Grid3x3, PieChart, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { CompletionDonut, TrendChart } from "../components/charts";
import { Note, PageHeader, Panel, QueryState } from "../components/ui";
import { RecommendationList, SkillHeatmap, type SkillRow } from "../components/widgets";
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
        <select className="input max-w-[160px]" value={cohort} onChange={(e) => setCohort(e.target.value)} aria-label="Cohorte">
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

export function Recommendations() {
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState("nueva");
  const q = useQuery({ queryKey: ["recommendations", status], queryFn: () => api<Recommendation[]>(`/recommendations?limit=60&status=${status}`) });
  const gen = useMutation({
    mutationFn: () => api<{ students: number; created: number }>("/recommendations/generate", { method: "POST", json: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations"] }),
  });
  return (
    <div>
      <PageHeader title="Recomendaciones de IA" subtitle="Modelo + reglas de negocio (catálogo publicado, niveles y no duplicar). Siempre revisables por el docente."
        actions={can(...STAFF, "docente", "ml_engineer") && (
          <button className="btn btn-primary" disabled={gen.isPending} onClick={() => gen.mutate()}><RefreshCw size={15} className={gen.isPending ? "animate-spin" : ""} /> Generar con el modelo vigente</button>
        )} />
      {gen.data && <p className="mb-3 text-sm text-teal">Se evaluaron {gen.data.students} estudiantes y se crearon {gen.data.created} recomendaciones nuevas.</p>}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {["nueva", "aceptada", "descartada", "completada", ""].map((s) => (
          <button key={s} className={`btn px-3 py-1 text-xs ${status === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setStatus(s)}>{s || "todas"}</button>
        ))}
      </div>
      <Panel icon={<Sparkles size={16} />} title="Bandeja">
        <QueryState q={q}>{(d) => <RecommendationList items={d} showStudent={me?.role !== "estudiante"} />}</QueryState>
      </Panel>
    </div>
  );
}
