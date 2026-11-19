import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Circle, Map, PlayCircle, Plus, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Badge, ErrorState, Field, Modal, Note, PageHeader, Panel, QueryState } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtDate, fmtNumber, fmtPercent } from "../lib/format";
import { StudentAI } from "./StudentAI";

interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  level: string;
  status: string;
  n_activities: number;
  instructor: { id: string; full_name: string } | null;
  enrolled: number;
  completed: number;
  avg_progress: number;
  my_enrollment?: { status: string; progress: number; completed_at: string | null } | null;
  assessments?: { id: string; title: string; type: string; max_score: number; due_at: string; max_attempts: number }[];
}

const LEVEL_TONE: Record<string, "teal" | "blue" | "violet"> = { basico: "teal", intermedio: "blue", avanzado: "violet" };

export function LearningPaths() {
  const q = useQuery({
    queryKey: ["paths"],
    queryFn: () => api<{ id: string; title: string; objective: string; status: string; steps: { position: number; course_id: string; code: string; title: string; level: string; my_status?: string; my_progress?: number }[] }[]>("/learning-paths"),
  });
  return (
    <div>
      <PageHeader title="Planes de aprendizaje" subtitle="Rutas con secuencia de cursos y criterios de logro" />
      <QueryState q={q} empty={(d) => !d.length}>
        {(paths) => (
          <div className="space-y-4">
            {paths.map((p) => (
              <Panel key={p.id} icon={<Map size={16} />} title={p.title} subtitle={p.objective} actions={<Badge tone="teal">{p.status}</Badge>}>
                <ol className="flex flex-col gap-3 md:flex-row md:items-stretch">
                  {p.steps.map((s, i) => (
                    <li key={s.course_id} className="flex flex-1 items-center gap-2">
                      <Link to={`/cursos/${s.course_id}`} className="panel flex-1 p-3 hover:border-cyan">
                        <p className="flex items-center gap-1.5 text-xs text-muted">
                          {s.my_status === "completado" ? <CheckCircle2 size={14} className="text-teal" /> : s.my_status && s.my_status !== "pendiente" ? <PlayCircle size={14} className="text-cyan" /> : <Circle size={14} />}
                          Paso {s.position} · {s.code}
                        </p>
                        <p className="mt-1 text-sm font-semibold">{s.title}</p>
                        <Badge tone={LEVEL_TONE[s.level]}>{s.level}</Badge>
                        {s.my_progress !== undefined && (
                          <div className="mt-2 h-1.5 rounded-full bg-ink/5"><div className="h-full rounded-full bg-cyan" style={{ width: `${s.my_progress * 100}%` }} /></div>
                        )}
                      </Link>
                      {i < p.steps.length - 1 && <span className="hidden text-cyan md:block">→</span>}
                    </li>
                  ))}
                </ol>
              </Panel>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}

export function Courses() {
  const { can, me } = useAuth();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [level, setLevel] = useState("");
  useEffect(() => setSearch(params.get("q") ?? ""), [params]);
  const [mine, setMine] = useState(me?.role === "estudiante");
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["courses", search, level, mine],
    queryFn: () => api<{ total: number; items: Course[] }>(`/courses?limit=100&q=${encodeURIComponent(search)}&level=${level}${mine ? "&mine=true" : ""}`),
  });
  return (
    <div>
      <PageHeader title="Cursos" subtitle="Catálogo, avance y estado de publicación"
        actions={can("admin", "superadmin", "coordinador") && <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Nuevo curso</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Buscar por nombre o código" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input max-w-[210px]" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Nivel">
          <option value="">Todos los niveles</option><option value="basico">Básico</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option>
        </select>
        {me?.role === "estudiante" && (
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Solo mis cursos</label>
        )}
      </div>
      <QueryState q={q} empty={(d) => !d.items.length}>
        {(d) => (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {d.items.map((c) => (
              <Link key={c.id} to={`/cursos/${c.id}`} className="panel block p-4 transition hover:border-cyan">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">{c.code}</p>
                    <p className="font-semibold">{c.title}</p>
                  </div>
                  <BookOpen size={18} className="shrink-0 text-cyan" />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={LEVEL_TONE[c.level]}>{c.level}</Badge>
                  <Badge tone={c.status === "publicado" ? "teal" : "muted"}>{c.status}</Badge>
                </div>
                {c.my_enrollment ? (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted"><span>Mi avance</span><span>{fmtPercent(c.my_enrollment.progress)}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-ink/5"><div className="h-full rounded-full bg-cyan" style={{ width: `${c.my_enrollment.progress * 100}%` }} /></div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted">
                    {fmtNumber(c.enrolled)} matriculados · {fmtNumber(c.completed)} completaron · avance medio {fmtPercent(c.avg_progress)}
                  </p>
                )}
                {c.instructor && <p className="mt-1 text-xs text-muted">Docente: {c.instructor.full_name}</p>}
              </Link>
            ))}
          </div>
        )}
      </QueryState>
      <CreateCourse open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function CreateCourse({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const skills = useQuery({ queryKey: ["skill-list"], queryFn: () => api<{ id: string; name: string }[]>("/skills"), enabled: open });
  const instructors = useQuery({ queryKey: ["users", "docente"], queryFn: () => api<{ id: string; full_name: string }[]>("/users?role=docente"), enabled: open, retry: false });
  const [form, setForm] = useState({ code: "", title: "", level: "basico", description: "", instructor_id: "", skill: "" });
  const m = useMutation({
    mutationFn: () => api("/courses", { method: "POST", json: {
      code: form.code.toUpperCase(), title: form.title, level: form.level, description: form.description,
      instructor_id: form.instructor_id || null, skills: form.skill ? { [form.skill]: 1 } : {},
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["courses"] }); onClose(); },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); m.mutate(); };
  return (
    <Modal open={open} onClose={onClose} title="Nuevo curso">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código"><input className="input" required pattern="[A-Za-z0-9\-]+" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Nivel">
            <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              <option value="basico">Básico</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option>
            </select>
          </Field>
        </div>
        <Field label="Título"><input className="input" required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Descripción"><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Docente">
            <select className="input" value={form.instructor_id} onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}>
              <option value="">Sin asignar</option>
              {instructors.data?.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </Field>
          <Field label="Competencia">
            <select className="input" value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })}>
              <option value="">Ninguna</option>
              {skills.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        {m.error && <ErrorState error={m.error} />}
        <p className="text-xs text-muted">El curso se crea en borrador; publícalo desde su detalle.</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={m.isPending}>Crear</button></div>
      </form>
    </Modal>
  );
}

export function CourseDetail() {
  const { id = "" } = useParams();
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["courses", id], queryFn: () => api<Course>(`/courses/${id}`) });
  const staffView = can("admin", "superadmin", "coordinador", "analista", "docente");
  const students = useQuery({
    queryKey: ["courses", id, "students"],
    queryFn: () => api<{ student_id: string; full_name: string; external_code: string; status: string; progress: number; average: number; attempts: number; region: string }[]>(`/courses/${id}/students`),
    enabled: staffView,
  });
  const publish = useMutation({
    mutationFn: (status: string) => api(`/courses/${id}`, { method: "PATCH", json: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });
  const event = useMutation({
    mutationFn: (type: string) => api<{ progress: number; status: string }>("/learning-events", { method: "POST", json: {
      event_id: crypto.randomUUID(), event_type: type, course_id: id,
      payload: type === "lesson_viewed" ? { duration_seconds: 600 } : { duration_seconds: 900 },
    } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });
  const [gradeFor, setGradeFor] = useState<{ assessment: string; student: string; score: string } | null>(null);
  const grade = useMutation({
    mutationFn: () => api(`/assessments/${gradeFor!.assessment}/grades`, { method: "POST", json: { student_id: gradeFor!.student, score: Number(gradeFor!.score) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["courses"] }); setGradeFor(null); },
  });

  return (
    <QueryState q={q}>
      {(c) => (
        <div className="space-y-4">
          <PageHeader title={c.title} subtitle={`${c.code} · ${c.level} · ${c.n_activities} actividades${c.instructor ? ` · ${c.instructor.full_name}` : ""}`}
            actions={can("admin", "superadmin", "coordinador") && (
              c.status === "publicado"
                ? <button className="btn btn-ghost" onClick={() => publish.mutate("archivado")}>Archivar</button>
                : <button className="btn btn-primary" onClick={() => publish.mutate("publicado")}>Publicar</button>
            )} />
          {c.description && <p className="text-sm text-muted">{c.description}</p>}

          {me?.role === "estudiante" && c.my_enrollment && (
            <Panel title="Mi avance" icon={<PlayCircle size={16} />} subtitle="Cada acción genera un evento que actualiza el dashboard en tiempo real">
              <div className="flex justify-between text-sm"><span>{c.my_enrollment.status}</span><span className="font-semibold">{fmtPercent(c.my_enrollment.progress)}</span></div>
              <div className="mt-1 h-2 rounded-full bg-ink/5"><div className="h-full rounded-full bg-gradient-to-r from-blue to-cyan" style={{ width: `${c.my_enrollment.progress * 100}%` }} /></div>
              {c.my_enrollment.status !== "completado" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn btn-ghost" disabled={event.isPending} onClick={() => event.mutate("lesson_viewed")}>Ver lección</button>
                  <button className="btn btn-primary" disabled={event.isPending} onClick={() => event.mutate("activity_completed")}>Completar actividad</button>
                </div>
              )}
              {event.error && <div className="mt-2"><ErrorState error={event.error} /></div>}
            </Panel>
          )}

          <Panel title="Evaluaciones" icon={<CheckCircle2 size={16} />}>
            {c.assessments?.length ? (
              <table className="data">
                <thead><tr><th>Evaluación</th><th>Tipo</th><th>Fecha límite</th><th className="text-right">Intentos</th></tr></thead>
                <tbody>{c.assessments.map((a) => <tr key={a.id}><td>{a.title}</td><td className="text-muted">{a.type}</td><td>{fmtDate(a.due_at)}</td><td className="text-right">{a.max_attempts}</td></tr>)}</tbody>
              </table>
            ) : <p className="text-sm text-muted">Sin evaluaciones.</p>}
          </Panel>

          {staffView && (
            <Panel title="Estudiantes matriculados" icon={<Users size={16} />} subtitle={can("docente", "admin", "superadmin") ? "Registra la nota oficial; la estimación de IA se guarda por separado" : undefined}>
              <QueryState q={students} empty={(d) => !d.length}>
                {(rows) => (
                  <div className="overflow-x-auto">
                    <table className="data min-w-[640px]">
                      <thead><tr><th>Estudiante</th><th>Región</th><th>Estado</th><th className="text-right">Avance</th><th className="text-right">Promedio</th><th /></tr></thead>
                      <tbody>
                        {rows.slice(0, 60).map((s) => (
                          <tr key={s.student_id}>
                            <td>{s.full_name}<span className="block text-[11px] text-muted">{s.external_code}</span></td>
                            <td className="text-muted">{s.region}</td>
                            <td><Badge tone={s.status === "completado" ? "teal" : s.status === "inactivo" ? "danger" : "blue"}>{s.status}</Badge></td>
                            <td className="text-right tabular-nums">{fmtPercent(s.progress)}</td>
                            <td className="text-right tabular-nums">{s.attempts ? s.average : "—"}</td>
                            <td>
                              {can("docente", "admin", "superadmin") && c.assessments?.length ? (
                                <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setGradeFor({ assessment: c.assessments![0].id, student: s.student_id, score: "" })}>Calificar</button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </QueryState>
            </Panel>
          )}

          <Modal open={!!gradeFor} onClose={() => setGradeFor(null)} title="Registrar nota oficial">
            {gradeFor && (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); grade.mutate(); }}>
                <Field label="Evaluación">
                  <select className="input" value={gradeFor.assessment} onChange={(e) => setGradeFor({ ...gradeFor, assessment: e.target.value })}>
                    {c.assessments?.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                  </select>
                </Field>
                <Field label="Nota (0–100)"><input className="input" type="number" min={0} max={100} step={0.1} required value={gradeFor.score} onChange={(e) => setGradeFor({ ...gradeFor, score: e.target.value })} /></Field>
                {grade.error && <ErrorState error={grade.error} />}
                <Note>La nota genera evidencia de competencias y un evento assessment.submitted en tiempo real.</Note>
                <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => setGradeFor(null)}>Cancelar</button><button className="btn btn-primary" disabled={grade.isPending}>Guardar</button></div>
              </form>
            )}
          </Modal>
        </div>
      )}
    </QueryState>
  );
}

export function Students() {
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["students", q],
    queryFn: () => api<{ total: number; items: { id: string; full_name: string; external_code: string; region: string; cohort: string }[] }>(`/students?limit=60&q=${encodeURIComponent(q)}`),
  });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && list.data?.items.length) setSelected(list.data.items[0].id);
  }, [list.data, selected]);
  const progress = useQuery({
    queryKey: ["student-progress", selected],
    queryFn: () => api<{ student: { full_name: string; external_code: string; region: string; cohort: string }; courses: { course_id: string; title: string; status: string; progress: number; average: number; attempts: number; last_activity: string | null }[] }>(`/students/${selected}/progress`),
    enabled: !!selected,
  });
  const courseTitles = Object.fromEntries((progress.data?.courses ?? []).map((c) => [c.course_id, c.title]));
  return (
    <div>
      <PageHeader title="Estudiantes" subtitle="Seguimiento académico y análisis de IA individual según permisos" />
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel title={`Listado (${list.data?.total ?? "…"})`} icon={<Users size={16} />}>
          <label className="mb-3 block">
            <span className="sr-only">Buscar estudiante</span>
            <input className="input" placeholder="Buscar por nombre o código" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <QueryState q={list} empty={(d) => !d.items.length}>
            {(d) => (
              <ul className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
                {d.items.map((s) => (
                  <li key={s.id}>
                    <button aria-current={selected === s.id} onClick={() => setSelected(s.id)}
                      className={`flex w-full items-center gap-3 rounded-[10px] border px-2.5 py-2 text-left text-sm transition ${selected === s.id ? "border-violet/50 bg-blue/15" : "border-transparent hover:bg-ink/5"}`}>
                      <Initials name={s.full_name} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{s.full_name}</span>
                        <span className="block truncate text-xs text-muted">{s.external_code} · {s.region} · {s.cohort}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </Panel>
        <div className="min-w-0 space-y-4">
          {!selected ? <Panel><p className="text-sm text-muted">Selecciona un estudiante.</p></Panel> : (
            <>
              <Panel title={progress.data?.student.full_name ?? "Progreso"} icon={progress.data ? <Initials name={progress.data.student.full_name} /> : <BookOpen size={16} />}
                subtitle={progress.data ? `${progress.data.student.external_code} · ${progress.data.student.region} · cohorte ${progress.data.student.cohort}` : undefined}>
                <QueryState q={progress} empty={(p) => !p.courses.length}>
                  {(p) => (
                    <div className="overflow-x-auto">
                      <table className="data min-w-[620px]">
                        <thead><tr><th>Curso</th><th>Estado</th><th className="w-[30%]">Avance</th><th className="text-right">Promedio</th><th className="text-right">Última actividad</th></tr></thead>
                        <tbody>
                          {p.courses.map((c) => (
                            <tr key={c.course_id}>
                              <td className="!align-middle font-semibold">{c.title}</td>
                              <td className="!align-middle"><Badge tone={c.status === "completado" ? "teal" : c.status === "inactivo" ? "danger" : "blue"}>{c.status}</Badge></td>
                              <td className="!align-middle">
                                <div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-blue" style={{ width: `${c.progress * 100}%` }} /></div><span className="w-10 text-right text-xs tabular-nums text-muted">{fmtPercent(c.progress)}</span></div>
                              </td>
                              <td className="!align-middle text-right tabular-nums">{c.attempts ? c.average : "—"}<span className="block text-[11px] text-muted">{c.attempts} evaluaciones</span></td>
                              <td className="!align-middle text-right text-xs text-muted">{fmtDate(c.last_activity)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </QueryState>
              </Panel>
              <StudentAI studentId={selected} courseTitles={courseTitles} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const ini = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-[11px] font-bold text-muted" aria-hidden>{ini}</span>;
}
