import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, MessageSquare, Plus, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EmptyState, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ROLE_LABEL, timeAgo } from "../lib/format";
import { useRealtimeEvent } from "../lib/realtime";

interface Conv { id: string; other: { id: string; name: string; role: string } | null; last_message: { body: string; created_at: string; mine: boolean } | null; unread: number }
interface Msg { id: string; sender_id: string; sender_name: string; body: string; created_at: string }
interface Thread { id: string; other: { id: string; name: string; role: string } | null; other_last_read_at: string | null; messages: Msg[] }
interface Contact { id: string; name: string; role: string; context: string }

const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

function Avatar({ name, role }: { name: string; role?: string }) {
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${role && role !== "estudiante" ? "bg-violet/20 text-violet" : "bg-surface-2 text-muted"} border border-line`} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Messages() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);
  const convs = useQuery({ queryKey: ["messages", "conversations"], queryFn: () => api<Conv[]>("/messages/conversations") });
  useRealtimeEvent(["message.created", "message.read"], () => {
    qc.invalidateQueries({ queryKey: ["messages"] });
  });
  const start = useMutation({
    mutationFn: (userId: string) => api<{ id: string }>("/messages/conversations", { method: "POST", json: { user_id: userId } }),
    onSuccess: (r) => { setPicking(false); qc.invalidateQueries({ queryKey: ["messages"] }); nav(`/mensajes/${r.id}`); },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Mensajes" subtitle="Conversaciones directas en tiempo real con tus compañeros de curso y docentes." />
      <div className="panel grid h-[calc(100vh-210px)] min-h-[480px] overflow-hidden md:grid-cols-[300px_minmax(0,1fr)]">
        <aside className={`flex min-h-0 flex-col border-line md:border-r ${id ? "hidden md:flex" : "flex"}`}>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="font-semibold">Conversaciones</span>
            <button className="btn btn-primary ml-auto px-2.5 py-1.5 text-xs" onClick={() => setPicking(true)}><Plus size={13} /> Nuevo</button>
          </div>
          {picking ? <ContactPicker onPick={(u) => start.mutate(u)} onClose={() => setPicking(false)} busy={start.isPending} /> : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {(convs.data ?? []).map((c) => (
                <li key={c.id}>
                  <button onClick={() => nav(`/mensajes/${c.id}`)} aria-current={c.id === id}
                    className={`flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition ${c.id === id ? "bg-blue/15" : "hover:bg-ink/5"}`}>
                    <Avatar name={c.other?.name ?? "?"} role={c.other?.role} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${c.unread ? "font-bold" : "font-semibold"}`}>{c.other?.name}</span>
                        {c.last_message && <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.last_message.created_at)}</span>}
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-xs ${c.unread ? "text-ink" : "text-muted"}`}>{c.last_message ? `${c.last_message.mine ? "Tú: " : ""}${c.last_message.body}` : "Sin mensajes"}</span>
                        {c.unread > 0 && <span className="shrink-0 rounded-full bg-blue px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {convs.data && !convs.data.length && <li className="p-4"><EmptyState message="Aún no tienes conversaciones. Pulsa Nuevo." icon={<MessageSquare size={22} />} /></li>}
            </ul>
          )}
        </aside>
        <section className={`min-h-0 flex-col ${id ? "flex" : "hidden md:flex"}`}>
          {id ? <ChatThread id={id} onBack={() => nav("/mensajes")} /> : (
            <div className="flex flex-1 items-center justify-center"><EmptyState message="Elige una conversación o inicia una nueva." icon={<MessageSquare size={22} />} /></div>
          )}
        </section>
      </div>
    </div>
  );
}

function ContactPicker({ onPick, onClose, busy }: { onPick: (id: string) => void; onClose: () => void; busy: boolean }) {
  const [q, setQ] = useState("");
  const contacts = useQuery({ queryKey: ["messages", "contacts"], queryFn: () => api<Contact[]>("/messages/contacts") });
  const list = (contacts.data ?? []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 p-3">
        <label className="sr-only" htmlFor="contact-q">Buscar contacto</label>
        <input id="contact-q" autoFocus className="input" placeholder="Buscar por nombre" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Cerrar"><X size={15} /></button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {list.map((c) => (
          <li key={c.id}>
            <button disabled={busy} onClick={() => onPick(c.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-ink/5">
              <Avatar name={c.name} role={c.role} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{c.name}</span>
                <span className="block truncate text-xs text-muted">{c.context}</span>
              </span>
            </button>
          </li>
        ))}
        {contacts.data && !list.length && <li className="p-4 text-sm text-muted">Sin contactos disponibles.</li>}
      </ul>
    </div>
  );
}

function ChatThread({ id, onBack }: { id: string; onBack: () => void }) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const t = useQuery({ queryKey: ["messages", "thread", id], queryFn: () => api<Thread>(`/messages/conversations/${id}`) });
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const send = useMutation({
    mutationFn: (body: string) => api<Msg>(`/messages/conversations/${id}/messages`, { method: "POST", json: { body } }),
    onMutate: (body) => {
      // Se muestra al instante; el servidor confirma y el evento en vivo lo entrega al destinatario.
      setText("");
      qc.setQueryData<Thread>(["messages", "thread", id], (old) => old && { ...old, messages: [...old.messages, { id: `tmp-${Date.now()}`, sender_id: me!.id, sender_name: me!.full_name, body, created_at: new Date().toISOString() }] });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
  const lastIncoming = t.data?.messages.filter((m) => m.sender_id !== me?.id).at(-1)?.id;
  useEffect(() => {
    if (lastIncoming) api(`/messages/conversations/${id}/read`, { method: "POST" }).then(() => qc.invalidateQueries({ queryKey: ["messages", "conversations"] })).catch(() => {});
  }, [id, lastIncoming, qc]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [t.data?.messages.length]);
  const submit = (e: FormEvent) => { e.preventDefault(); const b = text.trim(); if (b) send.mutate(b); };
  const lastMine = t.data?.messages.filter((m) => m.sender_id === me?.id).at(-1);
  const seen = lastMine && t.data?.other_last_read_at && new Date(t.data.other_last_read_at) >= new Date(lastMine.created_at);

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button className="btn btn-ghost px-2 md:hidden" onClick={onBack} aria-label="Volver">←</button>
        {t.data?.other && <Avatar name={t.data.other.name} role={t.data.other.role} />}
        <div className="min-w-0">
          <p className="truncate font-semibold">{t.data?.other?.name ?? "…"}</p>
          <p className="text-xs text-muted">{t.data?.other ? ROLE_LABEL[t.data.other.role] : ""}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
        {t.data?.messages.map((m, i) => {
          const mine = m.sender_id === me?.id;
          const prev = t.data!.messages[i - 1];
          const grouped = prev && prev.sender_id === m.sender_id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "" : "pt-1"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "rounded-br-md bg-blue text-white" : "rounded-bl-md border border-line bg-surface-2"} ${m.id.startsWith("tmp-") ? "opacity-70" : ""}`}>
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-white/75" : "text-muted"}`}>{timeAgo(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        {seen && <p className="flex items-center justify-end gap-1 text-[11px] text-muted"><CheckCheck size={13} className="text-teal" /> Visto</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <label className="sr-only" htmlFor="dm">Mensaje</label>
        <input id="dm" className="input" placeholder="Escribe un mensaje…" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary" disabled={!text.trim()} aria-label="Enviar mensaje"><Send size={15} /></button>
      </form>
    </>
  );
}
