import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, BrainCircuit, MessageCircleQuestion, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge, EmptyState, ErrorState, Note, PageHeader, Panel, QueryState } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtPercent, timeAgo } from "../lib/format";

interface CourseCtx {
  course_id: string;
  code: string;
  title: string;
  status: string;
  progress: number;
  mastery_level: string | null;
  risk_probability: number | null;
  completion_probability: number | null;
  skill_to_reinforce: string | null;
  model_version: number | null;
}

interface Item {
  title: string;
  body: string;
  link?: string;
  source?: string;
}

interface Msg {
  id: string;
  role: "student" | "tutor";
  content: string;
  course_id: string | null;
  created_at: string;
  payload: { sections?: { title: string; items: Item[] }[]; disclaimer?: string };
}

const SUGGESTIONS = ["¿Qué debo reforzar?", "¿Qué fallé en mis evaluaciones?", "¿Cómo voy en el curso?"];

export function Tutor() {
  const { me } = useAuth();
  return me?.role === "estudiante" ? <StudentTutor /> : <TutorInsights />;
}

function StudentTutor() {
  const qc = useQueryClient();
  const ctx = useQuery({ queryKey: ["tutor", "context"], queryFn: () => api<CourseCtx[]>("/tutor/context") });
  const [courseId, setCourseId] = useState<string>("");
  const history = useQuery({ queryKey: ["tutor", "history", courseId], queryFn: () => api<Msg[]>(`/tutor/history${courseId ? `?course_id=${courseId}` : ""}`) });
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const ask = useMutation({
    mutationFn: (message: string) => api<{ question: Msg; answer: Msg }>("/tutor/ask", { method: "POST", json: { message, course_id: courseId || null } }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["tutor", "history"] }); },
  });
  useEffect(() => {
    if (!courseId && ctx.data?.length) setCourseId((ctx.data.find((c) => c.status !== "completado") ?? ctx.data[0]).course_id);
  }, [ctx.data, courseId]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history.data, ask.isPending]);
  const current = ctx.data?.find((c) => c.course_id === courseId);
  const send = (e?: FormEvent, preset?: string) => {
    e?.preventDefault();
    const m = (preset ?? text).trim();
    if (m.length >= 2 && !ask.isPending) ask.mutate(m);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="IA Tutor" subtitle="Pregunta sobre tus cursos. Responde con el material del curso, tus errores en evaluaciones y lo que la red neuronal estima de tu nivel." />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="panel flex h-[calc(100vh-220px)] min-h-[480px] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <Bot size={18} className="text-violet" />
            <span className="font-semibold">Conversación</span>
            <label className="ml-auto flex items-center gap-2 text-xs text-muted">
              Curso
              <select className="input h-[34px] w-auto py-0 text-xs" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                {ctx.data?.map((c) => <option key={c.course_id} value={c.course_id}>{c.code} · {c.title}</option>)}
              </select>
            </label>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
            {history.isLoading ? null : !history.data?.length && !ask.isPending ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <MessageCircleQuestion size={28} className="text-violet" />
                <p className="max-w-sm text-sm text-muted">Pregúntame por un concepto («¿qué es una época?»), por lo que fallaste o qué te conviene reforzar en {current?.title ?? "tu curso"}.</p>
              </div>
            ) : (
              history.data?.map((m) => <Bubble key={m.id} m={m} />)
            )}
            {ask.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted"><Bot size={16} className="text-violet" /> Analizando tu pregunta…</div>
            )}
            <div ref={endRef} />
          </div>
          {ask.error && <div className="px-4"><ErrorState error={ask.error} /></div>}
          <div className="border-t border-line p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-violet/50 hover:text-ink" disabled={ask.isPending} onClick={() => send(undefined, s)}>{s}</button>
              ))}
            </div>
            <form onSubmit={send} className="flex gap-2">
              <label className="sr-only" htmlFor="tutor-input">Tu pregunta</label>
              <input id="tutor-input" className="input" placeholder="Escribe tu pregunta…" maxLength={600} value={text} onChange={(e) => setText(e.target.value)} />
              <button className="btn btn-primary" disabled={ask.isPending || text.trim().length < 2} aria-label="Enviar pregunta"><Send size={15} /></button>
            </form>
          </div>
        </section>
        <aside className="space-y-4">
          <Panel title="Lo que el modelo sabe de ti" icon={<BrainCircuit size={16} />} subtitle={current?.model_version ? `edumaster-mtl v${current.model_version}` : undefined}>
            <QueryState q={ctx} skeleton="h-40" empty={(d) => !d.length}>
              {() => current ? (
                <dl className="space-y-2.5 text-sm">
                  <Row label="Curso" value={current.title} />
                  <Row label="Avance" value={fmtPercent(current.progress)} />
                  <Row label="Nivel estimado" value={current.mastery_level ?? "—"} tone="text-violet capitalize" />
                  <Row label="Finalizar en 28 días" value={current.completion_probability != null ? fmtPercent(current.completion_probability) : "—"} tone="text-teal" />
                  <Row label="Señal de riesgo" value={current.risk_probability != null ? fmtPercent(current.risk_probability) : "—"} tone="text-danger" />
                  <Row label="Reforzar" value={current.skill_to_reinforce ?? "—"} tone="text-cyan" />
                </dl>
              ) : <p className="text-sm text-muted">Elige un curso.</p>}
            </QueryState>
          </Panel>
          <Note>El tutor adapta la explicación a tu nivel y solo usa el material del curso; no inventa respuestas. Si algo no queda claro, consulta a tu docente en Mensajes o Comunidad.</Note>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`truncate text-right font-semibold ${tone}`} title={value}>{value}</dd>
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  if (m.role === "student") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[75%] rounded-2xl rounded-br-md bg-blue px-4 py-2.5 text-sm text-white">{m.content}</p>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet/15 text-violet" aria-hidden><Bot size={16} /></span>
      <div className="min-w-0 max-w-[85%] space-y-2.5 rounded-2xl rounded-tl-md border border-line bg-surface-2 px-4 py-3 text-sm">
        <p>{m.content}</p>
        {m.payload.sections?.map((s) => (
          <div key={s.title}>
            <p className="mb-1.5 text-xs font-semibold text-muted">{s.title}</p>
            <ul className="space-y-1.5">
              {s.items.map((it, i) => (
                <li key={i} className="rounded-[10px] border border-line bg-surface px-3 py-2">
                  <p className="font-semibold">{it.link ? <Link to={it.link} className="text-violet hover:underline">{it.title} →</Link> : it.title}</p>
                  <p className="mt-0.5 text-muted">{it.body}</p>
                  {it.source && <p className="mt-1 text-[11px] text-muted">Fuente: {it.source}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-[11px] text-muted">{timeAgo(m.created_at)}</p>
      </div>
    </div>
  );
}

function TutorInsights() {
  const q = useQuery({ queryKey: ["tutor", "questions"], queryFn: () => api<{ id: string; student: string; course: string | null; question: string; created_at: string }[]>("/tutor/questions?limit=60") });
  return (
    <div className="space-y-4">
      <PageHeader title="IA Tutor · dudas de los estudiantes" subtitle="Preguntas recientes que tus estudiantes hicieron al tutor. Sirven para detectar temas que conviene reforzar en clase." />
      <section className="panel overflow-hidden">
        <QueryState q={q} skeleton="h-64" empty={(d) => !d.length}>
          {(d) => (
            <div className="overflow-x-auto">
              <table className="data min-w-[640px]">
                <thead><tr><th>Pregunta</th><th>Estudiante</th><th>Curso</th><th className="text-right">Cuándo</th></tr></thead>
                <tbody>
                  {d.map((x) => (
                    <tr key={x.id}>
                      <td className="!align-middle font-medium">{x.question}</td>
                      <td className="!align-middle">{x.student}</td>
                      <td className="!align-middle">{x.course ? <Badge tone="violet">{x.course}</Badge> : "—"}</td>
                      <td className="!align-middle text-right text-xs text-muted">{timeAgo(x.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
        {q.data && !q.data.length && <div className="p-6"><EmptyState message="Aún no hay preguntas al tutor." /></div>}
      </section>
    </div>
  );
}
