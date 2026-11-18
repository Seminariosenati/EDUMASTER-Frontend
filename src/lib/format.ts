const nf = new Intl.NumberFormat("es-PE");
const pf = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 1 });
const df = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });

export const fmtNumber = (n: number | null | undefined) => (n == null ? "—" : nf.format(n));
export const fmtPercent = (n: number | null | undefined) => (n == null ? "—" : pf.format(n));
export const fmtDate = (s: string | null | undefined) => (s ? df.format(new Date(s)) : "—");

export function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export function timeAgo(s: string) {
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (diff < 60) return "hace segundos";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadministrador",
  admin: "Administrador",
  coordinador: "Coordinador",
  docente: "Docente",
  estudiante: "Estudiante",
  analista: "Analista de datos",
  ml_engineer: "ML Engineer",
  auditor: "Auditor",
};
