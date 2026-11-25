import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, Plus, Send, Trash2, XCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, EmptyState, ErrorState, Field, Note, PageHeader, Panel, QueryState } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";

interface EvalItem {
  id: string;
  title: string;
  due_at: string;
  max_attempts: number;
  questions: number;
  course: { id: string; code: string; title: string };
  my_attempts?: number;
  best_score?: number | null;
  attempts?: number;
  avg_score?: number | null;
}

interface Question {
  id: string;
  position: number;
  type: "opcion_multiple" | "verdadero_falso" | "respuesta_corta";
  prompt: string;
  options: string[];
  points: number;
  answer?: { correct?: number; accepted?: string[] };
  explanation?: string;
}

interface EvalDetail {
  id: string;
  title: string;
  due_at: string;
  max_attempts: number;
  course: { id: string; code: string; title: string };
  questions: Question[];
  can_edit: boolean;
  my_attempts?: { attempt_number: number; score: number; is_late: boolean; submitted_at: string }[];
  remaining_attempts?: number;
}

interface Result {
  score: number;
  correct: number;
  total: number;
  is_late: boolean;
  remaining_attempts: number;
  detail: { question_id: string; correct: boolean; given: string | number; expected: string; explanation: string }[];
}

const TYPE_LABEL: Record<string, string> = { opcion_multiple: "Opción múltiple", verdadero_falso: "Verdadero o falso", respuesta_corta: "Respuesta corta" };

export function Evaluations() {
  const { me } = useAuth();
  const isStudent = me?.role === "estudiante";
  const [course, setCourse] = useState("");
  const q = useQuery({ queryKey: ["evaluations"], queryFn: () => api<EvalItem[]>("/evaluations") });
  const courses = Array.from(new Map((q.data ?? []).map((e) => [e.course.id, e.course])).values());
  const items = (q.data ?? []).filter((e) => !course || e.course.id === course);
  const now = Date.now();
  return (
    <div className="space-y-4">
      <PageHeader title="Evaluaciones" subtitle={isStudent ? "Responde tus evaluaciones; la corrección es automática y queda como nota oficial del intento." : "Banco de preguntas por evaluación, intentos y nota media de tus cursos."} />
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            Curso
            <select className="input max-w-xs" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">Todos</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
            </select>
          </label>
          <span className="ml-auto text-sm text-muted">{items.length} evaluaciones</span>
        </div>
        <QueryState q={q} skeleton="h-64" empty={() => !items.length}>
          {() => (
            <div className="overflow-x-auto">
              <table className="data min-w-[760px]">
                <thead>
                  <tr>
                    <th>Evaluación</th><th>Curso</th><th>Fecha límite</th><th className="text-right">Preguntas</th>
                    {isStudent ? <><th className="text-right">Intentos</th><th className="text-right">Mejor nota</th></> : <><th className="text-right">Intentos</th><th className="text-right">Nota media</th></>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => {
                    const overdue = new Date(e.due_at).getTime() < now;
                    const left = e.max_attempts - (e.my_attempts ?? 0);
                    return (
                      <tr key={e.id}>
                        <td className="!align-middle font-semibold">{e.title}</td>
                        <td className="!align-middle text-muted">{e.course.code}</td>
                        <td className="!align-middle text-xs">{fmtDate(e.due_at)} {overdue && <Badge tone="muted">vencida</Badge>}</td>
                        <td className="!align-middle text-right tabular-nums">{e.questions}</td>
                        {isStudent ? (
                          <>
                            <td className="!align-middle text-right tabular-nums">{e.my_attempts} / {e.max_attempts}</td>
                            <td className="!align-middle text-right tabular-nums">{e.best_score ?? "—"}</td>
                          </>
                        ) : (
                          <>
                            <td className="!align-middle text-right tabular-nums">{e.attempts}</td>
                            <td className="!align-middle text-right tabular-nums">{e.avg_score ?? "—"}</td>
                          </>
                        )}
                        <td className="!align-middle text-right">
                          <Link to={`/evaluaciones/${e.id}`} className={`btn px-3 py-1.5 text-xs ${isStudent && left > 0 && e.questions > 0 ? "btn-primary" : "btn-ghost"}`}>
                            {isStudent ? (left > 0 && e.questions > 0 ? "Responder" : "Ver resultado") : "Banco de preguntas"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </section>
    </div>
  );
}

export function EvaluationDetail() {
  const { id = "" } = useParams();
  const { me } = useAuth();
  const q = useQuery({ queryKey: ["evaluations", id], queryFn: () => api<EvalDetail>(`/evaluations/${id}`) });
  return (
    <QueryState q={q} skeleton="h-96">
      {(e) => (
        <div className="space-y-4">
          <PageHeader title={e.title} subtitle={`${e.course.code} · ${e.course.title} · fecha límite ${fmtDate(e.due_at)} · ${e.max_attempts} intentos`}
            actions={<Link to="/evaluaciones" className="btn btn-ghost">← Evaluaciones</Link>} />
          {me?.role === "estudiante" ? <TakeEvaluation e={e} /> : <QuestionBank e={e} />}
        </div>
      )}
    </QueryState>
  );
}

function TakeEvaluation({ e }: { e: EvalDetail }) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const submit = useMutation({
    mutationFn: () => api<Result>(`/evaluations/${e.id}/submit`, { method: "POST", json: { answers } }),
    onSuccess: (r) => {
      setResult(r);
      setAnswers({});
      qc.invalidateQueries({ queryKey: ["evaluations"] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });
  const answered = e.questions.filter((q) => String(answers[q.id] ?? "").trim() !== "").length;
  const left = e.remaining_attempts ?? 0;
  const detailById = Object.fromEntries((result?.detail ?? []).map((d) => [d.question_id, d]));
  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    submit.mutate();
  };

  if (!e.questions.length) return <Panel><EmptyState message="Esta evaluación aún no tiene preguntas." icon={<ClipboardCheck size={22} />} /></Panel>;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form onSubmit={onSubmit} className="space-y-3">
        {result && (
          <div role="status" className={`panel p-4 ${result.score >= 60 ? "border-teal/50" : "border-danger/50"}`}>
            <p className="text-sm text-muted">Resultado del intento</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{result.score}<span className="text-base font-medium text-muted"> / 100</span></p>
            <p className="mt-1 text-sm">{result.correct} de {result.total} correctas{result.is_late && " · entregado fuera de plazo"} · te quedan {result.remaining_attempts} intentos</p>
            <p className="mt-2 text-xs text-muted">La nota se registró como evaluación oficial, generó evidencia de competencias y actualizó el dashboard en tiempo real.</p>
          </div>
        )}
        {e.questions.map((q) => {
          const d = detailById[q.id];
          const chosen = d ? d.given : answers[q.id];
          const correctIdx = d && q.type !== "respuesta_corta" ? q.options.indexOf(d.expected) : -1;
          return (
            <fieldset key={q.id} className={`panel p-4 ${d ? (d.correct ? "border-teal/50" : "border-danger/50") : ""}`} disabled={left === 0 || submit.isPending}>
              <legend className="sr-only">Pregunta {q.position}</legend>
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold"><span className="mr-2 text-muted">{q.position}.</span>{q.prompt}</p>
                <Badge tone="muted">{TYPE_LABEL[q.type]}</Badge>
              </div>
              {q.type === "respuesta_corta" ? (
                <label className="mt-3 block">
                  <span className="sr-only">Tu respuesta</span>
                  <input className="input max-w-md" placeholder="Escribe tu respuesta" value={String(chosen ?? "")} onChange={(ev) => { setResult(null); setAnswers({ ...answers, [q.id]: ev.target.value }); }} />
                </label>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, i) => (
                    <label key={i} className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-sm transition ${
                      d && i === correctIdx ? "border-teal/60 bg-teal/10" : d && Number(chosen) === i ? "border-danger/60 bg-danger/10" : chosen === i ? "border-violet/60 bg-blue/10" : "border-line hover:bg-ink/5"}`}>
                      <input type="radio" name={q.id} className="accent-[var(--primary)]" checked={d ? Number(chosen) === i : chosen === i} onChange={() => { setResult(null); setAnswers({ ...answers, [q.id]: i }); }} />
                      {opt}
                      {d && Number(chosen) === i && <span className="ml-auto text-xs text-muted">tu respuesta</span>}
                    </label>
                  ))}
                </div>
              )}
              {d && (
                <p className={`mt-3 flex items-start gap-1.5 text-sm ${d.correct ? "text-teal" : "text-danger"}`}>
                  {d.correct ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
                  <span>{d.correct ? "Correcta." : `Incorrecta. Respuesta esperada: ${d.expected}.`} <span className="text-muted">{d.explanation}</span></span>
                </p>
              )}
            </fieldset>
          );
        })}
        {submit.error && <ErrorState error={submit.error} />}
      </form>
      <aside className="panel space-y-3 p-4 lg:sticky lg:top-24">
        <p className="text-sm font-semibold">Tu intento</p>
        <div>
          <div className="flex justify-between text-xs text-muted"><span>Respondidas</span><span className="tabular-nums">{answered} / {e.questions.length}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-blue transition-[width]" style={{ width: `${(answered / e.questions.length) * 100}%` }} /></div>
        </div>
        <p className="text-sm">Intentos restantes: <b>{left}</b> de {e.max_attempts}</p>
        <button type="button" className="btn btn-primary w-full justify-center" disabled={left === 0 || answered < e.questions.length || submit.isPending} onClick={() => submit.mutate()}>
          <Send size={15} /> {submit.isPending ? "Enviando…" : "Enviar respuestas"}
        </button>
        {left === 0 && <p className="text-xs text-muted">Ya usaste todos tus intentos.</p>}
        {!!e.my_attempts?.length && (
          <div className="border-t border-line pt-3">
            <p className="mb-1 text-xs font-semibold text-muted">Intentos anteriores</p>
            <ul className="space-y-1 text-sm">
              {e.my_attempts.map((a) => (
                <li key={a.attempt_number} className="flex justify-between"><span>Intento {a.attempt_number}</span><span className="tabular-nums font-semibold">{a.score}</span></li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function QuestionBank({ e }: { e: EvalDetail }) {
  const qc = useQueryClient();
  const empty = { type: "opcion_multiple", prompt: "", options: ["", "", "", ""], correct: 0, accepted: "", explanation: "" };
  const [form, setForm] = useState(empty);
  const add = useMutation({
    mutationFn: () => api(`/evaluations/${e.id}/questions`, {
      method: "POST",
      json: {
        type: form.type, prompt: form.prompt, explanation: form.explanation,
        options: form.type === "opcion_multiple" ? form.options : [],
        correct: form.type === "respuesta_corta" ? null : form.correct,
        accepted: form.type === "respuesta_corta" ? form.accepted.split(",").map((s) => s.trim()).filter(Boolean) : [],
      },
    }),
    onSuccess: () => { setForm(empty); qc.invalidateQueries({ queryKey: ["evaluations"] }); },
  });
  const del = useMutation({
    mutationFn: (qid: string) => api(`/evaluations/questions/${qid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evaluations"] }),
  });
  const correctText = (q: Question) => q.type === "respuesta_corta" ? (q.answer?.accepted ?? []).join(", ") : q.options[q.answer?.correct ?? 0];

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Panel title={`Banco de preguntas (${e.questions.length})`} icon={<ClipboardCheck size={16} />} subtitle="Los estudiantes no ven las respuestas correctas hasta enviar su intento">
        {e.questions.length ? (
          <ol className="divide-y divide-line">
            {e.questions.map((q) => (
              <li key={q.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="font-semibold"><span className="mr-2 text-muted">{q.position}.</span>{q.prompt}</p>
                  <p className="mt-1 text-xs text-muted">{TYPE_LABEL[q.type]}{q.options.length > 0 && q.type === "opcion_multiple" ? ` · ${q.options.join(" / ")}` : ""}</p>
                  <p className="mt-1 text-xs"><span className="text-muted">Correcta:</span> <b className="text-teal">{correctText(q)}</b></p>
                </div>
                {e.can_edit && (
                  <button className="btn btn-ghost h-9 px-2" aria-label={`Eliminar pregunta ${q.position}`} disabled={del.isPending} onClick={() => del.mutate(q.id)}><Trash2 size={14} /></button>
                )}
              </li>
            ))}
          </ol>
        ) : <EmptyState message="Aún no hay preguntas. Agrega la primera con el formulario." />}
      </Panel>
      {e.can_edit && (
        <Panel title="Nueva pregunta" icon={<Plus size={16} />}>
          <form className="space-y-3" onSubmit={(ev) => { ev.preventDefault(); add.mutate(); }}>
            <Field label="Tipo">
              <select className="input" value={form.type} onChange={(ev) => setForm({ ...form, type: ev.target.value, correct: 0 })}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Enunciado"><textarea className="input" rows={2} required minLength={5} value={form.prompt} onChange={(ev) => setForm({ ...form, prompt: ev.target.value })} /></Field>
            {form.type === "opcion_multiple" && (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs font-medium text-muted">Opciones (marca la correcta)</legend>
                {form.options.map((opt, i) => (
                  <label key={i} className="flex items-center gap-2">
                    <input type="radio" name="correct" className="accent-[var(--primary)]" checked={form.correct === i} onChange={() => setForm({ ...form, correct: i })} aria-label={`Opción ${i + 1} es la correcta`} />
                    <input className="input" placeholder={`Opción ${i + 1}`} value={opt} onChange={(ev) => setForm({ ...form, options: form.options.map((o, j) => (j === i ? ev.target.value : o)) })} />
                  </label>
                ))}
              </fieldset>
            )}
            {form.type === "verdadero_falso" && (
              <Field label="Respuesta correcta">
                <select className="input" value={form.correct} onChange={(ev) => setForm({ ...form, correct: Number(ev.target.value) })}>
                  <option value={0}>Verdadero</option><option value={1}>Falso</option>
                </select>
              </Field>
            )}
            {form.type === "respuesta_corta" && (
              <Field label="Respuestas aceptadas" hint="Sepáralas con comas. No distingue mayúsculas ni tildes.">
                <input className="input" required value={form.accepted} onChange={(ev) => setForm({ ...form, accepted: ev.target.value })} />
              </Field>
            )}
            <Field label="Explicación (se muestra al corregir)"><input className="input" value={form.explanation} onChange={(ev) => setForm({ ...form, explanation: ev.target.value })} /></Field>
            {add.error && <ErrorState error={add.error} />}
            <button className="btn btn-primary w-full justify-center" disabled={add.isPending}><Plus size={15} /> Agregar pregunta</button>
          </form>
          <div className="mt-3"><Note>La nota de cada intento se calcula sobre 100 y queda como calificación oficial; también genera evidencia para el dominio de habilidades.</Note></div>
        </Panel>
      )}
    </div>
  );
}
