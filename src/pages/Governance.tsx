import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CheckCircle2, Printer, ScrollText, ShieldAlert, UserPlus, Users, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Badge, ErrorState, Field, Modal, PageHeader, Panel, QueryState } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtDate, ROLE_LABEL } from "../lib/format";

interface Certificate {
  id: string;
  folio: string;
  verification_code: string;
  status: string;
  final_score: number;
  issued_at: string;
  student: { id: string; full_name: string };
  course: { id: string; code: string; title: string };
}

export function Certificates() {
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["certificates"], queryFn: () => api<Certificate[]>("/certificates?limit=100") });
  const [view, setView] = useState<Certificate | null>(null);
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/certificates/${id}/revoke`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["certificates"] }),
  });
  return (
    <div>
      <PageHeader title="Certificados" subtitle="Folio único, código de verificación y QR. Se emiten al cumplir los criterios oficiales del curso." />
      <Panel icon={<Award size={16} />} title={`Emitidos (${q.data?.length ?? "…"})`}>
        <QueryState q={q} empty={(d) => !d.length}>
          {(d) => (
            <div className="overflow-x-auto">
              <table className="data min-w-[680px]">
                <thead><tr><th>Folio</th>{me?.role !== "estudiante" && <th>Estudiante</th>}<th>Curso</th><th className="text-right">Nota</th><th>Fecha</th><th>Estado</th><th /></tr></thead>
                <tbody>
                  {d.map((c) => (
                    <tr key={c.id}>
                      <td className="font-mono text-xs">{c.folio}</td>
                      {me?.role !== "estudiante" && <td>{c.student.full_name}</td>}
                      <td>{c.course.title}</td>
                      <td className="text-right">{c.final_score}</td>
                      <td className="text-xs">{fmtDate(c.issued_at)}</td>
                      <td><Badge tone={c.status === "emitido" ? "teal" : "danger"}>{c.status}</Badge></td>
                      <td className="flex gap-1">
                        <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setView(c)}>Ver</button>
                        {can("admin", "superadmin") && c.status === "emitido" && (
                          <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => revoke.mutate(c.id)}>Anular</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </Panel>
      <Modal open={!!view} onClose={() => setView(null)} title="Certificado">
        {view && <CertificateCard c={view} org={me?.organization_name ?? ""} />}
      </Modal>
    </div>
  );
}

function CertificateCard({ c, org }: { c: Certificate; org: string }) {
  const url = `${window.location.origin}/verificar/${c.verification_code}`;
  return (
    <div>
      <div id="certificate" className="rounded-xl border-2 border-cyan/50 bg-gradient-to-br from-surface-2 to-bg p-5 text-center">
        <p className="text-xs uppercase tracking-widest text-cyan">{org}</p>
        <p className="mt-3 text-sm text-muted">Certifica que</p>
        <p className="text-2xl font-bold">{c.student.full_name}</p>
        <p className="mt-2 text-sm text-muted">completó satisfactoriamente el curso</p>
        <p className="text-lg font-semibold text-cyan">{c.course.title}</p>
        <p className="mt-1 text-xs text-muted">Nota final {c.final_score} · {fmtDate(c.issued_at)}</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <div className="rounded-lg bg-white p-2"><QRCodeSVG value={url} size={86} /></div>
          <div className="text-left text-xs">
            <p>Folio: <span className="font-mono">{c.folio}</span></p>
            <p>Código: <span className="font-mono">{c.verification_code}</span></p>
            <p className="text-muted">Verificar en {window.location.host}/verificar</p>
          </div>
        </div>
      </div>
      <button className="btn btn-primary mt-3" onClick={() => window.print()}><Printer size={15} /> Imprimir / guardar PDF</button>
    </div>
  );
}

export function Verify() {
  const { code = "" } = useParams();
  const [input, setInput] = useState(code);
  const [current, setCurrent] = useState(code);
  const q = useQuery({
    queryKey: ["verify", current],
    queryFn: () => api<{ valid: boolean; status: string; folio: string; holder: string; course: string; institution: string; issued_at: string; is_demo: boolean }>(`/certificates/verify/${encodeURIComponent(current)}`),
    enabled: !!current, retry: false,
  });
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="panel panel-glow w-full max-w-md p-6">
        <h1 className="mb-1 text-xl font-bold">Verificación de certificado</h1>
        <p className="mb-4 text-sm text-muted">EduMaster.ai · se muestran solo los datos mínimos.</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setCurrent(input.trim()); }}>
          <input className="input" placeholder="Código de verificación" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn btn-primary">Verificar</button>
        </form>
        {current && (
          <div className="mt-4">
            {q.isLoading && <p className="text-sm text-muted">Consultando…</p>}
            {q.error && <p className="flex items-center gap-2 text-danger"><XCircle size={18} /> Código no encontrado</p>}
            {q.data && (
              <div className="space-y-1 text-sm">
                <p className={`flex items-center gap-2 font-semibold ${q.data.valid ? "text-teal" : "text-danger"}`}>
                  {q.data.valid ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {q.data.valid ? "Certificado válido" : `Certificado ${q.data.status}`}
                </p>
                <p>Titular: {q.data.holder}</p>
                <p>Curso: {q.data.course}</p>
                <p>Institución: {q.data.institution} {q.data.is_demo && <Badge tone="warn">DEMO</Badge>}</p>
                <p>Emitido: {q.data.issued_at} · Folio {q.data.folio}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function UsersPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["users"], queryFn: () => api<{ id: string; email: string; full_name: string; role: string; status: string }[]>("/users") });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", role: "docente", password: "" });
  const create = useMutation({
    mutationFn: () => api("/users", { method: "POST", json: form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setOpen(false); },
  });
  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/users/${id}`, { method: "PATCH", json: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };
  return (
    <div>
      <PageHeader title="Usuarios" subtitle="RBAC validado en el backend; ocultar un botón no es seguridad."
        actions={<button className="btn btn-primary" onClick={() => setOpen(true)}><UserPlus size={15} /> Nuevo usuario</button>} />
      <Panel icon={<Users size={16} />} title="Usuarios de la institución">
        <QueryState q={q}>
          {(d) => (
            <table className="data">
              <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th /></tr></thead>
              <tbody>{d.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name}</td><td className="text-muted">{u.email}</td><td>{ROLE_LABEL[u.role]}</td>
                  <td><Badge tone={u.status === "activo" ? "teal" : "muted"}>{u.status}</Badge></td>
                  <td><button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => toggle.mutate({ id: u.id, status: u.status === "activo" ? "inactivo" : "activo" })}>{u.status === "activo" ? "Desactivar" : "Activar"}</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </QueryState>
      </Panel>
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo usuario">
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Nombre completo"><input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Correo"><input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Rol">
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABEL).filter(([k]) => k !== "superadmin").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Contraseña inicial" hint="Mínimo 8 caracteres"><input className="input" type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          {create.error && <ErrorState error={create.error} />}
          <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={create.isPending}>Crear</button></div>
        </form>
      </Modal>
    </div>
  );
}

export function Audit() {
  const [action, setAction] = useState("");
  const q = useQuery({ queryKey: ["audit", action], queryFn: () => api<{ id: string; action: string; resource: string; resource_id: string | null; actor: string; detail: Record<string, unknown>; occurred_at: string }[]>(`/audit-logs?limit=200${action ? `&action=${action}` : ""}`) });
  return (
    <div>
      <PageHeader title="Auditoría" subtitle="Bitácora de accesos, cambios, exportaciones y ciclo de vida del modelo (solo lectura)" />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {["", "login", "login_fallido", "registrar_nota", "exportar", "solicitar_entrenamiento", "promover_modelo", "emitir_certificado", "cambiar_rol"].map((a) => (
          <button key={a} className={`btn px-3 py-1 text-xs ${action === a ? "btn-primary" : "btn-ghost"}`} onClick={() => setAction(a)}>{a || "todas"}</button>
        ))}
      </div>
      <Panel icon={<ScrollText size={16} />} title="Eventos auditables">
        <QueryState q={q} empty={(d) => !d.length}>
          {(d) => (
            <div className="overflow-x-auto">
              <table className="data min-w-[720px]">
                <thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Recurso</th><th>Detalle</th></tr></thead>
                <tbody>{d.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap text-xs">{fmtDate(a.occurred_at)}</td>
                    <td className="text-xs">{a.actor}</td>
                    <td>{a.action.includes("fallido") ? <Badge tone="danger"><ShieldAlert size={11} /> {a.action}</Badge> : <Badge>{a.action}</Badge>}</td>
                    <td className="text-xs text-muted">{a.resource}</td>
                    <td className="max-w-xs truncate font-mono text-[11px] text-muted" title={JSON.stringify(a.detail)}>{JSON.stringify(a.detail)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </QueryState>
      </Panel>
    </div>
  );
}
