import { GraduationCap, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

const DEMO_ACCOUNTS = [
  ["admin@edumaster.demo", "Administrador"],
  ["docente@edumaster.demo", "Docente"],
  ["estudiante@edumaster.demo", "Estudiante"],
  ["ml@edumaster.demo", "ML Engineer"],
  ["coordinador@edumaster.demo", "Coordinador"],
  ["auditor@edumaster.demo", "Auditor"],
];

export function Login() {
  const { me, login } = useAuth();
  const [email, setEmail] = useState("admin@edumaster.demo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (me) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(8,127,229,0.25),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(139,77,255,0.18),transparent_50%)] p-4">
      <div className="panel panel-glow w-full max-w-md p-6">
        <div className="mb-6 text-center">
          <GraduationCap className="mx-auto mb-2 text-cyan" size={36} />
          <h1 className="text-2xl font-bold">EduMaster<span className="text-cyan">.ai</span></h1>
          <p className="mt-1 text-sm text-muted">Aprende · Practica · Destaca</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">Correo</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">Contraseña</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button className="btn btn-primary w-full justify-center py-2" disabled={busy}>
            <LogIn size={16} /> {busy ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
        <div className="mt-6 rounded-lg border border-line bg-white/[0.02] p-3 text-xs text-muted">
          <p className="mb-2 font-semibold text-ink">Cuentas DEMO (contraseña: Demo2026!)</p>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map(([mail, label]) => (
              <button key={mail} type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => { setEmail(mail); setPassword("Demo2026!"); }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
