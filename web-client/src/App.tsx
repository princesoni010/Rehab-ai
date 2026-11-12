import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { Shell } from "./components/Shell";
import { useAuth } from "./lib/auth";
import { ImmersiveProvider } from "./lib/ImmersiveContext";
import { DoctorDashboardPage } from "./pages/DoctorDashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { PatientExercisePage } from "./pages/PatientExercisePage";
import { PatientProgressPage } from "./pages/PatientProgressPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { UserManagementPage } from "./pages/UserManagementPage";
import { ExerciseCatalogPage } from "./pages/ExerciseCatalogPage";
import { HealthDashboardPage } from "./pages/HealthDashboardPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="screen-center">Loading session...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="screen-center">Loading session...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}

export function App() {
  return (
    <ImmersiveProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Shell />
            </RequireAuth>
          }
        >
          <Route index element={<RoleHome />} />
          <Route path="doctor" element={<DoctorDashboardPage />} />
          <Route path="patient/exercise" element={<PatientExercisePage />} />
          <Route path="patient/progress" element={<PatientProgressPage />} />
          <Route path="health/dashboard" element={<HealthDashboardPage />} />
          <Route path="patient" element={<Navigate to="/patient/exercise" replace />} />

          <Route
            path="admin/*"
            element={
              <RequireAdmin>
                <Outlet />
              </RequireAdmin>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<UserManagementPage />} />
            <Route path="exercises" element={<ExerciseCatalogPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ImmersiveProvider>
  );
}

function RoleHome() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === "admin") {
    return <Navigate to="/admin" replace />;
  }
  if (user.role === "doctor") {
    return <Navigate to="/doctor" replace />;
  }
  return <Navigate to="/health/dashboard" replace />;
}
