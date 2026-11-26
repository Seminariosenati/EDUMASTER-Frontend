import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Skeleton } from "./components/ui";
import "./index.css";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import type { Role } from "./lib/types";
import { Courses, CourseDetail, LearningPaths, Students } from "./pages/Academic";
import { Dashboard } from "./pages/Dashboard";
import { EvaluationDetail, Evaluations } from "./pages/Evaluations";
import { Community, CommunityPost } from "./pages/Community";
import { Messages } from "./pages/Messages";
import { Tutor } from "./pages/Tutor";
import { Audit, Certificates, UsersPage, Verify } from "./pages/Governance";
import { Analytics, Recommendations } from "./pages/Insights";
import { Login } from "./pages/Login";
import { NeuralLab } from "./pages/NeuralLab";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 } },
});

function Protected({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { me, loading } = useAuth();
  if (loading) return <div className="p-6"><Skeleton className="h-40" /></div>;
  if (!me) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(me.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const STAFF: Role[] = ["superadmin", "admin", "coordinador", "analista"];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/verificar" element={<Verify />} />
            <Route path="/verificar/:code" element={<Verify />} />
            <Route element={<Protected><AppShell /></Protected>}>
              <Route index element={<Dashboard />} />
              <Route path="rutas" element={<LearningPaths />} />
              <Route path="cursos" element={<Courses />} />
              <Route path="cursos/:id" element={<CourseDetail />} />
              <Route path="evaluaciones" element={<Evaluations />} />
              <Route path="tutor" element={<Protected roles={[...STAFF, "docente", "estudiante"]}><Tutor /></Protected>} />
              <Route path="comunidad" element={<Community />} />
              <Route path="comunidad/:postId" element={<CommunityPost />} />
              <Route path="mensajes" element={<Messages />} />
              <Route path="mensajes/:id" element={<Messages />} />
              <Route path="evaluaciones/:id" element={<EvaluationDetail />} />
              <Route path="analisis" element={<Protected roles={[...STAFF, "docente", "auditor"]}><Analytics /></Protected>} />
              <Route path="ia" element={<NeuralLab />} />
              <Route path="recomendaciones" element={<Recommendations />} />
              <Route path="certificados" element={<Certificates />} />
              <Route path="estudiantes" element={<Protected roles={[...STAFF, "docente"]}><Students /></Protected>} />
              <Route path="usuarios" element={<Protected roles={["admin", "superadmin"]}><UsersPage /></Protected>} />
              <Route path="auditoria" element={<Protected roles={["auditor", "admin", "superadmin"]}><Audit /></Protected>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
