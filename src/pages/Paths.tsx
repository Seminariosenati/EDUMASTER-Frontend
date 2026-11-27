import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronRight, Circle, History, Lock, Map, Pencil, PlayCircle, Plus,
  Trash2, UserMinus, Users, X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, EmptyState, ErrorState, Field, Note, PageHeader, Panel, QueryState, Skeleton } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtPercent, timeAgo } from "../lib/format";

interface Step {
  position: number; course_id: string; code: string; title: string; level: string; course_status: string;
  required: boolean; skills: string[]; duration_weeks: number; min_progress: number; criteria: string;
}
interface StepState { position: number; state: "completado" | "en_curso" | "disponible" | "bloqueado"; progress: number; enrolled: boolean; blocked_by: string | null }
interface Progress { steps: StepState[]; progress: number; completed_steps: number; required_steps: number; state: "completada" | "en_curso" | "sin_iniciar"; next_step: number | null }
interface PathRow {
  id: string; title: string; objective: string; status: string; version: number; created_at: string; steps: Step[]; total_weeks: number;
  stats?: { assigned: number; completed: number; avg_progress: number };
  assigned?: boolean; me?: Progress;
}
interface Assignment extends Progress { id: string; student_id: string; name: string; code: string; cohort: string; via: string; assigned_at: string }
interface HistoryItem { id: string; version: number; action: string; summary: string; actor: string; created_at: string }
interface PathDetailData extends PathRow {
  validation: { ok: boolean; errors: string[]; warnings: string[]; total_weeks: number };
  assignments: Assignment[]; history: HistoryItem[];
}
interface CourseOpt { id: string; code: string; title: string; level: string; status: string }

const LEVEL_TONE: Record<string, "teal" | "blue" | "violet"> = { basico: "teal", intermedio: "blue", avanzado: "violet" };
const STATUS_TONE: Record<string, "teal" | "muted" | "warn"> = { publicado: "teal", borrador: "warn", archivado: "muted" };
const PROGRESS_LABEL = { completada: "Completada", en_curso: "En curso", sin_iniciar: "Sin iniciar" };
const ACTION_LABEL: Record<string, string> = {
  crear: "Creación", editar: "Edición", publicar: "Publicación", archivar: "Archivo", restaurar: "Restauración",
  asignar: "Asignación", retirar: "Retiro", unirse: "Inscripción propia",
};

export function LearningPaths() {
  const { me } = useAuth();
  return me?.role === "estudiante" ? <StudentPaths /> : <StaffPaths />;
}

/* ---------------- Personal académico ---------------- */

function StaffPaths() {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ["paths"], queryFn: () => api<PathRow[]>("/learning-paths") });
  const editor = can("admin", "superadmin", "coordinador");
  return (
    <div className="space-y-4">
      <PageHeader title="Planes de aprendizaje" subtitle="Rutas con secuencia de cursos, prerrequisitos y criterios de logro. Se asignan a cohortes o estudiantes."
        actions={editor && <Link to="/rutas/nueva" className="btn btn-primary"><Plus size={15} /> Nueva ruta</Link>} />
      <QueryState q={q} empty={(d) => !d.length}>
        {(paths) => (
          <div className="space-y-3">
            {paths.map((p) => (
              <Link key={p.id} to={`/rutas/${p.id}`} className="panel group block p-4 transition hover:border-violet/50">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold"><Map size={16} className="text-cyan" /> {p.title}</p>
                    {p.objective && <p className="mt-0.5 text-sm text-muted">{p.objective}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                    <span className="font-mono text-xs text-muted">v{p.version}</span>
                    <ChevronRight size={16} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
                  </div>
                </div>
                <StepRow steps={p.steps} />
                {p.stats && (
                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                    <Stat label="Asignados" value={String(p.stats.assigned)} />
                    <Stat label="Completaron" value={String(p.stats.completed)} />
                    <Stat label="Avance medio" value={fmtPercent(p.stats.avg_progress)} />
                    <Stat label="Duración" value={`${p.total_weeks} semanas`} />
                  </dl>
                )}
              </Link>
            ))}
          </div>
        )}
      </QueryState>
      {q.data && !q.data.length && <EmptyState message="Aún no hay rutas. Crea la primera con «Nueva ruta»." icon={<Map size={22} />} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="flex gap-1.5"><dt>{label}</dt><dd className="font-semibold tabular-nums text-ink">{value}</dd></div>;
}

function StepRow({ steps, states }: { steps: Step[]; states?: StepState[] }) {
  return (
    <ol className="mt-3 flex flex-col gap-2 md:flex-row md:items-stretch">
      {steps.map((s, i) => {
        const st = states?.[i];
        return (
          <li key={s.position} className="flex flex-1 items-center gap-2">
            <div className={`flex-1 rounded-[12px] border border-line bg-surface-2/60 px-3 py-2.5 ${st?.state === "bloqueado" ? "opacity-60" : ""}`}>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                {st ? <StateIcon state={st.state} /> : <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ink/10 text-[10px] font-bold text-ink">{s.position}</span>}
                {s.code}{!s.required && " · opcional"}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold" title={s.title}>{s.title}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Badge tone={LEVEL_TONE[s.level]}>{s.level}</Badge>
                <span className="text-[11px] text-muted">{s.duration_weeks} sem</span>
              </div>
            </div>
            {i < steps.length - 1 && <ChevronRight size={16} className="hidden shrink-0 text-muted md:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function StateIcon({ state }: { state: StepState["state"] }) {
  if (state === "completado") return <CheckCircle2 size={14} className="text-teal" aria-label="Completado" />;
  if (state === "en_curso") return <PlayCircle size={14} className="text-cyan" aria-label="En curso" />;
  if (state === "bloqueado") return <Lock size={13} aria-label="Bloqueado" />;
  return <Circle size={14} className="text-violet" aria-label="Disponible" />;
}

/* ---------------- Detalle / editor ---------------- */

type Tab = "pasos" | "asignacion" | "historial";

export function PathDetail() {
  const { id } = useParams();
  const { me, can } = useAuth();
  const isNew = id === "nueva";
  const editor = can("admin", "superadmin", "coordinador");
  const q = useQuery({ queryKey: ["paths", id], queryFn: () => api<PathDetailData>(`/learning-paths/${id}`), enabled: !isNew });
  const [tab, setTab] = useState<Tab>("pasos");
  const [editing, setEditing] = useState(isNew);
  if (me?.role === "estudiante") return <StudentPaths focus={id} />;
  if (isNew) return <PathEditor onDone={() => setEditing(false)} />;
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorState error={q.error} />;
  const p = q.data;
  return (
    <div className="space-y-4">
      <div>
        <Link to="/rutas" className="text-xs text-muted hover:text-ink">← Planes de aprendizaje</Link>
        <PageHeader title={p.title} subtitle={p.objective || "Sin objetivo descrito"}
          actions={<PathActions p={p} editor={editor} editing={editing} onEdit={() => { setTab("pasos"); setEditing(true); }} />} />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge> <span className="font-mono">v{p.version}</span></span>
        <Stat label="Pasos" value={String(p.steps.length)} />
        <Stat label="Duración" value={`${p.total_weeks} semanas`} />
        {p.stats && <Stat label="Asignados" value={String(p.stats.assigned)} />}
        {p.stats && <Stat label="Avance medio" value={fmtPercent(p.stats.avg_progress)} />}
      </div>
      <div role="tablist" aria-label="Secciones de la ruta" className="flex gap-1 border-b border-line">
        {([["pasos", "Pasos"], ["asignacion", `Asignación · ${p.assignments.length}`], ["historial", "Historial"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${tab === k ? "border-violet text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === "pasos" && (editing ? <PathEditor path={p} onDone={() => setEditing(false)} /> : <StepsView p={p} />)}
      {tab === "asignacion" && <AssignmentsView p={p} editor={editor} />}
      {tab === "historial" && <HistoryView items={p.history} />}
    </div>
  );
}

function PathActions({ p, editor, editing, onEdit }: { p: PathDetailData; editor: boolean; editing: boolean; onEdit: () => void }) {
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: (what: "publish" | "archive") => api(`/learning-paths/${p.id}/${what}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["paths"] }),
  });
  if (!editor) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {act.error && <span className="max-w-xs text-xs text-danger">{(act.error as Error).message}</span>}
      {!editing && p.status !== "archivado" && <button className="btn btn-ghost" onClick={onEdit}><Pencil size={14} /> Editar</button>}
      {p.status === "borrador" && (
        <button className="btn btn-primary" disabled={act.isPending || !p.validation.ok} onClick={() => act.mutate("publish")}
          title={p.validation.ok ? undefined : "Corrige los errores de validación"}>Publicar</button>
      )}
      <button className="btn btn-ghost" disabled={act.isPending} onClick={() => act.mutate("archive")}>
        {p.status === "archivado" ? "Restaurar" : "Archivar"}
      </button>
    </div>
  );
}

function StepsView({ p }: { p: PathDetailData }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <ol className="panel divide-y divide-line">
        {p.steps.map((s) => (
          <li key={s.position} className="flex gap-4 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-sm font-bold">{s.position}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/cursos/${s.course_id}`} className="font-semibold hover:text-violet">{s.title}</Link>
                <span className="font-mono text-xs text-muted">{s.code}</span>
                <Badge tone={LEVEL_TONE[s.level]}>{s.level}</Badge>
                {!s.required && <Badge tone="muted">opcional</Badge>}
                {s.course_status !== "publicado" && <Badge tone="warn">curso {s.course_status}</Badge>}
              </div>
              {s.criteria && <p className="mt-1 text-sm text-muted">{s.criteria}</p>}
              <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                <Stat label="Duración" value={`${s.duration_weeks} semanas`} />
                <Stat label="Logro" value={`avance ≥ ${fmtPercent(s.min_progress)}`} />
                <Stat label="Requisito" value={s.position === 1 ? "ninguno" : `paso ${p.steps.slice(0, s.position - 1).filter((x) => x.required).at(-1)?.position ?? "—"}`} />
              </dl>
              {s.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">{s.skills.map((k) => <span key={k} className="rounded-md bg-ink/5 px-1.5 py-0.5 text-[11px] text-muted">{k}</span>)}</div>
              )}
            </div>
          </li>
        ))}
        {!p.steps.length && <li className="p-4"><EmptyState message="Esta ruta aún no tiene pasos. Pulsa Editar para agregarlos." /></li>}
      </ol>
      <ValidationBox v={p.validation} status={p.status} />
    </div>
  );
}

function ValidationBox({ v, status }: { v: PathDetailData["validation"]; status: string }) {
  return (
    <Panel title="Validación de prerrequisitos" icon={v.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}>
      {v.ok ? (
        <p className="flex items-center gap-2 text-sm text-teal"><CheckCircle2 size={15} /> {status === "publicado" ? "Ruta publicada y consistente" : "Lista para publicar"}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">{v.errors.map((e) => <li key={e} className="flex gap-2 text-danger"><X size={14} className="mt-0.5 shrink-0" />{e}</li>)}</ul>
      )}
      {v.warnings.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-sm">{v.warnings.map((w) => <li key={w} className="flex gap-2 text-warn"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{w}</li>)}</ul>
      )}
      <p className="mt-3 text-xs text-muted">Se revisa que cada curso esté publicado, que no se repita y que el nivel no baje entre pasos.</p>
    </Panel>
  );
}

interface DraftStep { key: string; course_id: string; required: boolean; duration_weeks: number; min_progress: number; criteria: string }

function PathEditor({ path, onDone }: { path?: PathDetailData; onDone: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const courses = useQuery({ queryKey: ["courses", "path-editor"], queryFn: () => api<{ items: CourseOpt[] }>("/courses?limit=200") });
  const [title, setTitle] = useState(path?.title ?? "");
  const [objective, setObjective] = useState(path?.objective ?? "");
  const [steps, setSteps] = useState<DraftStep[]>(() => (path?.steps ?? []).map((s) => ({
    key: `${s.position}-${s.course_id}`, course_id: s.course_id, required: s.required, duration_weeks: s.duration_weeks,
    min_progress: s.min_progress, criteria: s.criteria,
  })));
  const save = useMutation({
    mutationFn: () => {
      const json = { title, objective, steps: steps.map(({ key: _k, ...s }) => s) };
      return path ? api<{ id: string }>(`/learning-paths/${path.id}`, { method: "PUT", json }) : api<{ id: string }>("/learning-paths", { method: "POST", json });
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["paths"] }); onDone(); if (!path) nav(`/rutas/${r.id}`); },
  });
  const byId = Object.fromEntries((courses.data?.items ?? []).map((c) => [c.id, c]));
  const used = new Set(steps.map((s) => s.course_id));
  const update = (i: number, patch: Partial<DraftStep>) => setSteps((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => setSteps((xs) => { const ys = [...xs]; [ys[i], ys[i + d]] = [ys[i + d], ys[i]]; return ys; });
  const add = () => {
    const next = courses.data?.items.find((c) => c.status === "publicado" && !used.has(c.id));
    if (next) setSteps((xs) => [...xs, { key: `n-${Date.now()}`, course_id: next.id, required: true, duration_weeks: 4, min_progress: 0.8, criteria: "" }]);
  };
  const levelDrop = (i: number) => i > 0 && (LEVEL_ORDER[byId[steps[i].course_id]?.level] ?? 0) < (LEVEL_ORDER[byId[steps[i - 1].course_id]?.level] ?? 0);

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      {!path && <PageHeader title="Nueva ruta" subtitle="Se guarda como borrador. Podrás validarla, publicarla y asignarla después." />}
      <div className="panel grid gap-3 p-4 md:grid-cols-2">
        <Field label="Nombre de la ruta"><input className="input" required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Desarrollo web profesional" /></Field>
        <Field label="Objetivo"><input className="input" maxLength={600} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Qué logrará el estudiante al terminar" /></Field>
      </div>
      <section className="panel">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">Pasos en orden</h2>
          <span className="text-xs text-muted">{steps.reduce((a, s) => a + s.duration_weeks, 0)} semanas en total</span>
        </header>
        <ol className="divide-y divide-line">
          {steps.map((s, i) => (
            <li key={s.key} className="grid gap-3 p-4 md:grid-cols-[32px_minmax(0,2fr)_110px_120px_minmax(0,2fr)_auto] md:items-end">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface-2 text-sm font-bold">{i + 1}</span>
              <Field label="Curso">
                <select className="input" value={s.course_id} onChange={(e) => update(i, { course_id: e.target.value })}>
                  {courses.data?.items.filter((c) => c.id === s.course_id || !used.has(c.id)).map((c) => (
                    <option key={c.id} value={c.id}>{c.code} · {c.title} ({c.level}){c.status !== "publicado" ? " — sin publicar" : ""}</option>
                  ))}
                </select>
              </Field>
              <Field label="Semanas"><input className="input" type="number" min={1} max={52} value={s.duration_weeks} onChange={(e) => update(i, { duration_weeks: Number(e.target.value) || 1 })} /></Field>
              <Field label="Avance mínimo">
                <select className="input" value={s.min_progress} onChange={(e) => update(i, { min_progress: Number(e.target.value) })}>
                  {[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => <option key={v} value={v}>{v === 1 ? "100 %" : `${Math.round(v * 100)} %`}</option>)}
                </select>
              </Field>
              <Field label="Criterio de logro"><input className="input" maxLength={300} value={s.criteria} onChange={(e) => update(i, { criteria: e.target.value })} placeholder="Qué demuestra al terminar" /></Field>
              <div className="flex items-center gap-1">
                <label className="mr-1 flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={s.required} onChange={(e) => update(i, { required: e.target.checked })} /> Obligatorio</label>
                <IconBtn label="Subir" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></IconBtn>
                <IconBtn label="Bajar" disabled={i === steps.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></IconBtn>
                <IconBtn label="Quitar paso" onClick={() => setSteps((xs) => xs.filter((_, j) => j !== i))}><Trash2 size={14} /></IconBtn>
              </div>
              {levelDrop(i) && <p className="flex items-center gap-1.5 text-xs text-warn md:col-span-6"><AlertTriangle size={13} /> Este curso es de menor nivel que el paso anterior; no podrás publicar la ruta en este orden.</p>}
            </li>
          ))}
          {!steps.length && <li className="p-4 text-sm text-muted">Agrega el primer curso de la ruta.</li>}
        </ol>
        <div className="border-t border-line p-3">
          <button type="button" className="btn btn-ghost" onClick={add} disabled={!courses.data || steps.length >= 20}><Plus size={14} /> Agregar paso</button>
        </div>
      </section>
      {save.error && <ErrorState error={save.error} />}
      {path?.status === "publicado" && <Note>La ruta está publicada: al guardar se crea la versión v{path.version + 1} y el cambio queda en el historial. Los estudiantes asignados conservan su avance.</Note>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => (path ? onDone() : nav("/rutas"))}>Cancelar</button>
        <button className="btn btn-primary" disabled={save.isPending || !title.trim()}>{save.isPending ? "Guardando…" : path ? "Guardar cambios" : "Crear borrador"}</button>
      </div>
    </form>
  );
}

const LEVEL_ORDER: Record<string, number> = { basico: 1, intermedio: 2, avanzado: 3 };

function IconBtn({ label, children, ...rest }: { label: string; children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className="btn btn-ghost h-[34px] w-[34px] justify-center p-0" aria-label={label} title={label} {...rest}>{children}</button>;
}

function AssignmentsView({ p, editor }: { p: PathDetailData; editor: boolean }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"todos" | Progress["state"]>("todos");
  const remove = useMutation({
    mutationFn: (aid: string) => api(`/learning-paths/${p.id}/assignments/${aid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["paths"] }),
  });
  const rows = p.assignments.filter((a) => filter === "todos" || a.state === filter);
  const counts = { completada: 0, en_curso: 0, sin_iniciar: 0 };
  p.assignments.forEach((a) => { counts[a.state] += 1; });
  return (
    <div className="space-y-4">
      {editor && (p.status === "publicado" ? <AssignBar pathId={p.id} /> : <Note>Publica la ruta para poder asignarla.</Note>)}
      <section className="panel overflow-hidden">
        <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="mr-auto flex items-center gap-2 text-sm font-semibold"><Users size={16} className="text-cyan" /> Avance de los estudiantes</h2>
          {(["todos", "sin_iniciar", "en_curso", "completada"] as const).map((k) => (
            <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
              className={`btn px-2.5 py-1 text-xs ${filter === k ? "btn-primary" : "btn-ghost"}`}>
              {k === "todos" ? `Todos · ${p.assignments.length}` : `${PROGRESS_LABEL[k]} · ${counts[k]}`}
            </button>
          ))}
        </header>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="data min-w-[760px]">
              <thead><tr><th>Estudiante</th><th>Cohorte</th><th>Pasos</th><th className="text-right">Avance</th><th>Estado</th><th>Asignada</th>{editor && <th />}</tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="!align-middle"><p className="font-medium">{a.name}</p><p className="font-mono text-[11px] text-muted">{a.code}</p></td>
                    <td className="!align-middle text-sm">{a.cohort}</td>
                    <td className="!align-middle"><StepBar steps={p.steps} states={a.steps} /></td>
                    <td className="!align-middle text-right font-semibold tabular-nums">{fmtPercent(a.progress)}</td>
                    <td className="!align-middle"><Badge tone={a.state === "completada" ? "teal" : a.state === "en_curso" ? "blue" : "muted"}>{PROGRESS_LABEL[a.state]}</Badge></td>
                    <td className="!align-middle text-xs text-muted">{a.via} · {timeAgo(a.assigned_at)}</td>
                    {editor && (
                      <td className="!align-middle text-right">
                        <button className="btn btn-ghost px-2 py-1 text-xs" disabled={remove.isPending} onClick={() => { if (confirm(`¿Retirar a ${a.name} de la ruta? Conserva sus cursos y notas.`)) remove.mutate(a.id); }}>
                          <UserMinus size={13} /> Retirar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="p-6"><EmptyState message={p.assignments.length ? "Nadie en este estado." : "La ruta aún no está asignada a nadie."} icon={<Users size={22} />} /></div>}
      </section>
    </div>
  );
}

function StepBar({ steps, states }: { steps: Step[]; states: StepState[] }) {
  const tone = { completado: "bg-teal", en_curso: "bg-cyan", disponible: "", bloqueado: "" };
  return (
    <div className="flex items-center gap-1" aria-label={states.map((s, i) => `${steps[i]?.code}: ${s.state}`).join(", ")}>
      {states.map((s, i) => (
        <span key={s.position} title={`${steps[i]?.code} · ${s.state.replace("_", " ")} · ${fmtPercent(s.progress)}`} className={`relative h-2 w-9 overflow-hidden rounded-full bg-ink/10 ${s.state === "disponible" ? "ring-1 ring-inset ring-violet/60" : ""}`}>
          <span className={`absolute inset-y-0 left-0 rounded-full ${tone[s.state]}`} style={{ width: s.state === "completado" ? "100%" : s.state === "en_curso" ? `${Math.max(8, s.progress * 100)}%` : "0%" }} />
        </span>
      ))}
    </div>
  );
}

function AssignBar({ pathId }: { pathId: string }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"cohorte" | "estudiantes">("cohorte");
  const [cohort, setCohort] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const cohorts = useQuery({ queryKey: ["paths", "cohorts"], queryFn: () => api<{ cohort: string; students: number }[]>("/learning-paths/cohorts") });
  const found = useQuery({
    queryKey: ["students", "pick", search],
    queryFn: () => api<{ items: { id: string; full_name: string; external_code: string; cohort: string }[] }>(`/students?limit=8&q=${encodeURIComponent(search)}`),
    enabled: mode === "estudiantes" && search.trim().length >= 2,
  });
  useEffect(() => { if (!cohort && cohorts.data?.length) setCohort(cohorts.data[0].cohort); }, [cohorts.data, cohort]);
  const assign = useMutation({
    mutationFn: () => api<{ message: string }>(`/learning-paths/${pathId}/assignments`, {
      method: "POST", json: mode === "cohorte" ? { cohort } : { student_ids: picked.map((x) => x.id) },
    }),
    onSuccess: () => { setPicked([]); setSearch(""); qc.invalidateQueries({ queryKey: ["paths"] }); },
  });
  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div role="radiogroup" aria-label="Asignar a" className="flex rounded-[10px] border border-line p-0.5">
          {(["cohorte", "estudiantes"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
              className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${mode === m ? "bg-violet text-white" : "text-muted hover:text-ink"}`}>
              {m === "cohorte" ? "Una cohorte" : "Estudiantes"}
            </button>
          ))}
        </div>
        {mode === "cohorte" ? (
          <Field label="Cohorte">
            <select className="input min-w-[220px]" value={cohort} onChange={(e) => setCohort(e.target.value)}>
              {cohorts.data?.map((c) => <option key={c.cohort} value={c.cohort}>{c.cohort} · {c.students} estudiantes</option>)}
            </select>
          </Field>
        ) : (
          <div className="relative min-w-[260px] flex-1">
            <Field label="Buscar estudiante"><input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre o código (mín. 2 letras)" /></Field>
            {found.data && search.trim().length >= 2 && (
              <ul className="panel absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto p-1">
                {found.data.items.filter((s) => !picked.some((p) => p.id === s.id)).map((s) => (
                  <li key={s.id}>
                    <button type="button" className="flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-sm hover:bg-ink/5"
                      onClick={() => { setPicked((xs) => [...xs, { id: s.id, name: s.full_name }]); setSearch(""); }}>
                      <span>{s.full_name}</span><span className="text-xs text-muted">{s.external_code} · {s.cohort}</span>
                    </button>
                  </li>
                ))}
                {!found.data.items.length && <li className="px-2.5 py-2 text-sm text-muted">Sin resultados.</li>}
              </ul>
            )}
          </div>
        )}
        <button className="btn btn-primary" disabled={assign.isPending || (mode === "cohorte" ? !cohort : !picked.length)} onClick={() => assign.mutate()}>
          {assign.isPending ? "Asignando…" : "Asignar ruta"}
        </button>
      </div>
      {mode === "estudiantes" && picked.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {picked.map((x) => (
            <span key={x.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs">
              {x.name}
              <button type="button" aria-label={`Quitar ${x.name}`} className="rounded-full p-0.5 text-muted hover:text-ink" onClick={() => setPicked((xs) => xs.filter((y) => y.id !== x.id))}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      {assign.data && <p className="mt-2 text-sm text-teal" role="status">{assign.data.message}. Recibirán una notificación.</p>}
      {assign.error && <div className="mt-2"><ErrorState error={assign.error} /></div>}
    </section>
  );
}

function HistoryView({ items }: { items: HistoryItem[] }) {
  return (
    <section className="panel p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><History size={16} className="text-cyan" /> Historial de cambios</h2>
      <ol className="relative space-y-4 pl-6 before:absolute before:bottom-1 before:left-[7px] before:top-1 before:w-px before:bg-line">
        {items.map((h) => (
          <li key={h.id} className="relative">
            <span className="absolute -left-6 top-1 h-[15px] w-[15px] rounded-full border-2 border-surface bg-violet" aria-hidden />
            <p className="text-sm"><span className="font-mono text-xs text-muted">v{h.version}</span> <b>{ACTION_LABEL[h.action] ?? h.action}</b> · {h.summary}</p>
            <p className="text-xs text-muted">{h.actor} · {timeAgo(h.created_at)}</p>
          </li>
        ))}
      </ol>
      {!items.length && <p className="text-sm text-muted">Sin cambios registrados.</p>}
    </section>
  );
}

/* ---------------- Estudiante ---------------- */

function StudentPaths({ focus }: { focus?: string }) {
  const q = useQuery({ queryKey: ["paths"], queryFn: () => api<PathRow[]>("/learning-paths") });
  const mine = (q.data ?? []).filter((p) => p.assigned && p.me);
  const others = (q.data ?? []).filter((p) => !p.assigned);
  return (
    <div className="space-y-4">
      <PageHeader title="Mis rutas de aprendizaje" subtitle="Avanza paso a paso. Cada curso se desbloquea cuando cumples el criterio del anterior." />
      {q.isLoading ? <Skeleton className="h-72" /> : q.error ? <ErrorState error={q.error} /> : (
        <>
          {mine.map((p) => <StudentPathCard key={p.id} p={p} highlight={p.id === focus} />)}
          {!mine.length && <EmptyState message="Aún no tienes rutas asignadas. Puedes unirte a una de las disponibles." icon={<Map size={22} />} />}
          {others.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted">Otras rutas disponibles</h2>
              {others.map((p) => <AvailablePath key={p.id} p={p} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StudentPathCard({ p, highlight }: { p: PathRow; highlight?: boolean }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const me = p.me!;
  const start = useMutation({
    mutationFn: (pos: number) => api<{ message: string; course_id: string }>(`/learning-paths/${p.id}/steps/${pos}/start`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["paths"] }); qc.invalidateQueries({ queryKey: ["courses"] }); },
  });
  return (
    <section className={`panel p-4 ${highlight ? "panel-glow" : ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold"><Map size={16} className="text-cyan" /> {p.title}</h2>
          {p.objective && <p className="mt-0.5 text-sm text-muted">{p.objective}</p>}
        </div>
        <div className="w-full max-w-[240px]">
          <div className="flex justify-between text-xs"><span className="text-muted">{me.completed_steps} de {me.required_steps} pasos</span><b className="tabular-nums">{fmtPercent(me.progress)}</b></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-teal transition-[width] duration-500" style={{ width: `${me.progress * 100}%` }} /></div>
        </div>
      </header>
      <ol className="mt-4 space-y-2">
        {p.steps.map((s, i) => {
          const st = me.steps[i];
          const isNext = me.next_step === s.position;
          return (
            <li key={s.position} className={`flex flex-wrap items-center gap-3 rounded-[12px] border px-3 py-3 sm:flex-nowrap ${isNext ? "border-violet/60 bg-violet/[0.06]" : "border-line"} ${st.state === "bloqueado" ? "text-muted" : ""}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${st.state === "completado" ? "border-teal/50 bg-teal/15 text-teal" : st.state === "bloqueado" ? "border-line bg-surface-2" : "border-violet/40 bg-violet/10 text-violet"}`}>
                {st.state === "completado" ? <CheckCircle2 size={16} /> : st.state === "bloqueado" ? <Lock size={14} /> : <span className="text-sm font-bold">{s.position}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className={`font-semibold ${st.state === "bloqueado" ? "" : "text-ink"}`}>{s.title}</span>
                  <Badge tone={LEVEL_TONE[s.level]}>{s.level}</Badge>
                  {isNext && <Badge tone="violet">Siguiente paso</Badge>}
                  {!s.required && <Badge tone="muted">opcional</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {st.state === "bloqueado" ? `Se desbloquea al cumplir ${st.blocked_by}` : s.criteria || `Logro: avance ≥ ${fmtPercent(s.min_progress)}`}
                  {" · "}{s.duration_weeks} semanas
                </p>
                {st.state === "en_curso" && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-ink/10">
                      <div className="h-full rounded-full bg-cyan" style={{ width: `${st.progress * 100}%` }} />
                      <span className="absolute inset-y-0 w-px bg-ink/50" style={{ left: `${s.min_progress * 100}%` }} title="Meta del paso" />
                    </div>
                    <span className="text-xs tabular-nums text-muted">{fmtPercent(st.progress)} de {fmtPercent(s.min_progress)}</span>
                  </div>
                )}
              </div>
              <div className="shrink-0">
                {st.state === "disponible" && (
                  <button className="btn btn-primary" disabled={start.isPending} onClick={() => start.mutate(s.position)}><PlayCircle size={15} /> Comenzar</button>
                )}
                {(st.state === "en_curso" || st.state === "completado") && (
                  <button className="btn btn-ghost" onClick={() => nav(`/cursos/${s.course_id}`)}>{st.state === "completado" ? "Repasar" : "Continuar"}</button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {start.data && <p className="mt-3 text-sm text-teal" role="status">{start.data.message}.</p>}
      {start.error && <div className="mt-3"><ErrorState error={start.error} /></div>}
    </section>
  );
}

function AvailablePath({ p }: { p: PathRow }) {
  const qc = useQueryClient();
  const join = useMutation({
    mutationFn: () => api(`/learning-paths/${p.id}/join`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["paths"] }),
  });
  return (
    <div className="panel flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{p.title}</p>
        <p className="text-xs text-muted">{p.steps.map((s) => s.code).join(" → ")} · {p.total_weeks} semanas</p>
      </div>
      <button className="btn btn-ghost" disabled={join.isPending} onClick={() => join.mutate()}><Plus size={14} /> Unirme</button>
      {join.error && <p className="w-full text-xs text-danger">{(join.error as Error).message}</p>}
    </div>
  );
}
