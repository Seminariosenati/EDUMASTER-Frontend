import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, Bell, EyeOff, Eye, Flag, Megaphone, MessagesSquare, Pin, PinOff, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, EmptyState, ErrorState, Field, PageHeader, Panel, QueryState } from "../components/ui";
import { api } from "../lib/api";
import { ROLE_LABEL, timeAgo } from "../lib/format";

interface Space { course_id: string; code: string; title: string; posts: number; last_activity: string | null; role: string; muted: boolean; open_reports: number }
interface Author { id: string; name: string; role: string }
interface Post { id: string; course_id: string; kind: "anuncio" | "debate"; title: string; body: string; pinned: boolean; status: string; created_at: string; author: Author | null; comments: number; mine: boolean }
interface Report { id: string; course: { id: string; title: string }; target_type: string; reason: string; automatic: boolean; created_at: string; post_id: string | null; excerpt: string; author: string | null }

function AuthorLine({ a, at }: { a: Author | null; at: string }) {
  const staff = a && a.role !== "estudiante";
  return (
    <p className="text-xs text-muted">
      <span className={`font-semibold ${staff ? "text-violet" : "text-ink"}`}>{a?.name ?? "Usuario"}</span>
      {a && <> · {ROLE_LABEL[a.role] ?? a.role}</>} · {timeAgo(at)}
    </p>
  );
}

function StatusBadge({ s }: { s: string }) {
  if (s === "visible") return null;
  return <Badge tone={s === "en_revision" ? "warn" : "muted"}>{s === "en_revision" ? "en revisión" : s}</Badge>;
}

export function Community() {
  const qc = useQueryClient();
  const spaces = useQuery({ queryKey: ["community", "spaces"], queryFn: () => api<Space[]>("/community/spaces") });
  const [courseId, setCourseId] = useState("");
  const [kind, setKind] = useState<"" | "anuncio" | "debate">("");
  const [showReports, setShowReports] = useState(false);
  useEffect(() => { if (!courseId && spaces.data?.length) setCourseId(spaces.data[0].course_id); }, [spaces.data, courseId]);
  const space = spaces.data?.find((s) => s.course_id === courseId);
  const posts = useQuery({
    queryKey: ["community", "posts", courseId, kind],
    queryFn: () => api<{ role: string; posts: Post[] }>(`/community/posts?course_id=${courseId}${kind ? `&kind=${kind}` : ""}`),
    enabled: !!courseId,
  });
  const mute = useMutation({
    mutationFn: (muted: boolean) => api(`/community/spaces/${courseId}/mute`, { method: "POST", json: { muted } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community", "spaces"] }),
  });
  const totalReports = spaces.data?.reduce((n, s) => n + s.open_reports, 0) ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Comunidad" subtitle="Un espacio por curso: anuncios del docente y debates entre estudiantes. Respeto y apoyo mutuo."
        actions={totalReports > 0 && (
          <button className={`btn ${showReports ? "btn-primary" : "btn-ghost"}`} onClick={() => setShowReports((v) => !v)}>
            <ShieldAlert size={15} /> Reportes pendientes {totalReports}
          </button>
        )} />
      {showReports ? <Reports /> : (
        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Panel title="Espacios" icon={<MessagesSquare size={16} />}>
            <QueryState q={spaces} skeleton="h-48" empty={(d) => !d.length}>
              {(d) => (
                <ul className="-mx-1 space-y-1">
                  {d.map((s) => (
                    <li key={s.course_id}>
                      <button onClick={() => setCourseId(s.course_id)} aria-current={s.course_id === courseId}
                        className={`w-full rounded-[10px] border px-3 py-2 text-left text-sm transition ${s.course_id === courseId ? "border-violet/50 bg-blue/15" : "border-transparent hover:bg-ink/5"}`}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold">{s.title}</span>
                          {s.open_reports > 0 && <Badge tone="warn">{s.open_reports}</Badge>}
                        </span>
                        <span className="block text-xs text-muted">{s.posts} publicaciones{s.last_activity ? ` · ${timeAgo(s.last_activity)}` : ""}{s.muted ? " · silenciado" : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
          </Panel>
          <div className="min-w-0 space-y-4">
            {space && (
              <section className="panel">
                <div className="flex flex-wrap items-center gap-3 border-b border-line px-4">
                  <div role="tablist" aria-label="Tipo" className="-mb-px flex">
                    {([["", "Todo"], ["anuncio", "Anuncios"], ["debate", "Debates"]] as const).map(([k, label]) => (
                      <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
                        className={`border-b-2 px-3.5 py-3 text-sm font-semibold transition ${kind === k ? "border-blue text-ink" : "border-transparent text-muted hover:text-ink"}`}>{label}</button>
                    ))}
                  </div>
                  <button className="btn btn-ghost ml-auto px-2.5 py-1.5 text-xs" disabled={mute.isPending} onClick={() => mute.mutate(!space.muted)}
                    title={space.muted ? "Volver a recibir notificaciones de este espacio" : "Dejar de recibir notificaciones de este espacio"}>
                    {space.muted ? <><Bell size={13} /> Activar avisos</> : <><BellOff size={13} /> Silenciar</>}
                  </button>
                </div>
                {space.role !== "lector" && <Composer courseId={space.course_id} canAnnounce={space.role === "moderador"} />}
              </section>
            )}
            <QueryState q={posts} skeleton="h-64" empty={(d) => !d.posts.length}>
              {(d) => (
                <ul className="space-y-3">
                  {d.posts.map((p) => (
                    <li key={p.id}>
                      <Link to={`/comunidad/${p.id}`} className={`panel block p-4 transition hover:border-violet/50 ${p.status !== "visible" ? "opacity-70" : ""}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          {p.kind === "anuncio" ? <Badge tone="violet"><Megaphone size={11} /> Anuncio</Badge> : <Badge tone="blue">Debate</Badge>}
                          {p.pinned && <Badge tone="muted"><Pin size={11} /> Fijado</Badge>}
                          <StatusBadge s={p.status} />
                        </div>
                        <p className="mt-2 font-semibold">{p.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{p.body}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <AuthorLine a={p.author} at={p.created_at} />
                          <span className="text-xs text-muted">{p.comments} comentarios</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
            {posts.data && !posts.data.posts.length && <Panel><EmptyState message="Aún no hay publicaciones aquí. ¡Empieza la conversación!" /></Panel>}
          </div>
        </div>
      )}
    </div>
  );
}

function Composer({ courseId, canAnnounce }: { courseId: string; canAnnounce: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "debate", title: "", body: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api<{ notice: string | null }>("/community/posts", { method: "POST", json: { course_id: courseId, ...form } }),
    onSuccess: (r) => { setNotice(r.notice); setForm({ kind: "debate", title: "", body: "" }); setOpen(false); qc.invalidateQueries({ queryKey: ["community"] }); },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };
  if (!open) {
    return (
      <div className="flex items-center gap-3 p-4">
        <button className="input text-left text-muted" onClick={() => { setOpen(true); setNotice(null); }}>Escribe una pregunta o comparte algo con tu curso…</button>
        {notice && <span className="shrink-0 text-xs text-warn">{notice}</span>}
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-3 p-4">
      {canAnnounce && (
        <div role="radiogroup" aria-label="Tipo" className="flex gap-2 text-sm">
          {[["debate", "Debate"], ["anuncio", "Anuncio (notifica al curso)"]].map(([k, l]) => (
            <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-1.5 ${form.kind === k ? "border-violet/50 bg-blue/10" : "border-line"}`}>
              <input type="radio" className="accent-[var(--primary)]" checked={form.kind === k} onChange={() => setForm({ ...form, kind: k })} /> {l}
            </label>
          ))}
        </div>
      )}
      <Field label="Título"><input className="input" required minLength={3} maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
      <Field label="Mensaje"><textarea className="input" required minLength={3} rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
      {create.error && <ErrorState error={create.error} />}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
        <button className="btn btn-primary" disabled={create.isPending}>Publicar</button>
      </div>
    </form>
  );
}

export function CommunityPost() {
  const { postId = "" } = useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ["community", "post", postId],
    queryFn: () => api<{ role: string; course: { id: string; title: string }; post: Post; comments: { id: string; body: string; status: string; created_at: string; author: Author | null; mine: boolean }[] }>(`/community/posts/${postId}`),
  });
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["community"] });
  const comment = useMutation({
    mutationFn: () => api<{ notice: string | null }>(`/community/posts/${postId}/comments`, { method: "POST", json: { body: text } }),
    onSuccess: (r) => { setText(""); setNotice(r.notice); refresh(); },
  });
  const modPost = useMutation({ mutationFn: (action: string) => api(`/community/posts/${postId}/moderate`, { method: "POST", json: { action } }), onSuccess: refresh });
  const modComment = useMutation({ mutationFn: ({ id, action }: { id: string; action: string }) => api(`/community/comments/${id}/moderate`, { method: "POST", json: { action } }), onSuccess: refresh });
  const del = useMutation({ mutationFn: () => api(`/community/posts/${postId}`, { method: "DELETE" }), onSuccess: () => { refresh(); nav("/comunidad"); } });
  const report = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) => api("/community/reports", { method: "POST", json: { target_type: type, target_id: id, reason: "Contenido inapropiado reportado por un miembro" } }),
    onSuccess: () => setNotice("Gracias. Un moderador revisará el reporte."),
  });

  return (
    <QueryState q={q} skeleton="h-96">
      {(d) => {
        const mod = d.role === "moderador";
        const p = d.post;
        return (
          <div className="mx-auto max-w-3xl space-y-4">
            <Link to="/comunidad" className="btn btn-ghost">← {d.course.title}</Link>
            <article className="panel p-5">
              <div className="flex flex-wrap items-center gap-2">
                {p.kind === "anuncio" ? <Badge tone="violet"><Megaphone size={11} /> Anuncio</Badge> : <Badge tone="blue">Debate</Badge>}
                {p.pinned && <Badge tone="muted"><Pin size={11} /> Fijado</Badge>}
                <StatusBadge s={p.status} />
                <span className="ml-auto flex flex-wrap gap-1.5">
                  {mod && <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => modPost.mutate(p.pinned ? "desfijar" : "fijar")}>{p.pinned ? <><PinOff size={13} /> Desfijar</> : <><Pin size={13} /> Fijar</>}</button>}
                  {mod && <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => modPost.mutate(p.status === "visible" ? "ocultar" : "mostrar")}>{p.status === "visible" ? <><EyeOff size={13} /> Ocultar</> : <><Eye size={13} /> Aprobar</>}</button>}
                  {(p.mine || mod) && <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => del.mutate()}><Trash2 size={13} /> Eliminar</button>}
                  {!p.mine && !mod && <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => report.mutate({ type: "post", id: p.id })}><Flag size={13} /> Reportar</button>}
                </span>
              </div>
              <h1 className="mt-3 text-xl font-bold">{p.title}</h1>
              <div className="mt-1"><AuthorLine a={p.author} at={p.created_at} /></div>
              <p className="mt-4 whitespace-pre-line leading-relaxed">{p.body}</p>
            </article>
            {notice && <p role="status" className="rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-sm">{notice}</p>}
            <section className="panel p-5">
              <h2 className="mb-3 font-semibold">{d.comments.length} comentarios</h2>
              <ul className="divide-y divide-line">
                {d.comments.map((c) => (
                  <li key={c.id} className={`py-3 first:pt-0 ${c.status !== "visible" ? "opacity-70" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <AuthorLine a={c.author} at={c.created_at} />
                      <span className="flex items-center gap-1.5">
                        <StatusBadge s={c.status} />
                        {mod && <button className="text-xs text-muted hover:text-ink" onClick={() => modComment.mutate({ id: c.id, action: c.status === "visible" ? "ocultar" : "mostrar" })}>{c.status === "visible" ? "Ocultar" : "Aprobar"}</button>}
                        {!c.mine && !mod && <button className="text-xs text-muted hover:text-ink" aria-label="Reportar comentario" onClick={() => report.mutate({ type: "comment", id: c.id })}><Flag size={12} /></button>}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm">{c.body}</p>
                  </li>
                ))}
              </ul>
              {d.role !== "lector" && p.status === "visible" && (
                <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) comment.mutate(); }}>
                  <label className="sr-only" htmlFor="comment">Comentario</label>
                  <input id="comment" className="input" placeholder="Escribe un comentario…" value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} />
                  <button className="btn btn-primary" disabled={comment.isPending || !text.trim()}>Comentar</button>
                </form>
              )}
              {comment.error && <div className="mt-2"><ErrorState error={comment.error} /></div>}
            </section>
          </div>
        );
      }}
    </QueryState>
  );
}

function Reports() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["community", "reports"], queryFn: () => api<Report[]>("/community/reports") });
  const resolve = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api(`/community/reports/${id}/resolve`, { method: "POST", json: { action } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community"] }),
  });
  return (
    <section className="panel overflow-hidden">
      <QueryState q={q} skeleton="h-48" empty={(d) => !d.length}>
        {(d) => (
          <table className="data">
            <thead><tr><th>Contenido</th><th>Curso</th><th>Motivo</th><th className="text-right">Acción</th></tr></thead>
            <tbody>
              {d.map((r) => (
                <tr key={r.id}>
                  <td className="!align-middle">
                    <p className="max-w-[48ch] truncate">{r.excerpt}</p>
                    <p className="text-xs text-muted">{r.author} · {r.target_type === "post" ? "publicación" : "comentario"} · {timeAgo(r.created_at)}</p>
                  </td>
                  <td className="!align-middle">{r.course.title}</td>
                  <td className="!align-middle text-sm">{r.automatic ? <Badge tone="warn">automático</Badge> : null} {r.reason}</td>
                  <td className="!align-middle text-right whitespace-nowrap">
                    {r.post_id && <Link to={`/comunidad/${r.post_id}`} className="btn btn-ghost mr-1.5 px-2.5 py-1.5 text-xs">Ver</Link>}
                    <button className="btn btn-primary mr-1.5 px-2.5 py-1.5 text-xs" onClick={() => resolve.mutate({ id: r.id, action: "ocultar" })}>Ocultar</button>
                    <button className="btn btn-ghost px-2.5 py-1.5 text-xs" onClick={() => resolve.mutate({ id: r.id, action: "descartar" })}>Aprobar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </QueryState>
      {q.data && !q.data.length && <div className="p-6"><EmptyState message="No hay reportes pendientes." /></div>}
    </section>
  );
}
