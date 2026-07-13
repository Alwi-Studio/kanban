import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { ToastProvider } from "./components/ui/Toast";
import { useAuthStore } from "./store/authStore";
import { refreshToken } from "./services/auth";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const BoardPage = lazy(() => import("./pages/BoardPage"));
const BoardsPage = lazy(() => import("./pages/BoardsPage"));
const GlobalBoardPage = lazy(() => import("./pages/GlobalBoardPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

function AppLoading() {
  return (
    <div className="min-h-screen bg-bg-page dark:bg-bg-dark flex items-center justify-center">
      <div className="w-9 h-9 rounded-full border-4 border-brand/20 border-t-brand animate-spin" aria-label="Loading" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoading = useAuthStore(s => s.isLoading);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  if (isLoading) return <AppLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isLoading = useAuthStore(s => s.isLoading);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  if (isLoading) return <AppLoading />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const setLoading = useAuthStore(s => s.setLoading);

  useEffect(() => {
    const stored = localStorage.getItem("darkMode");
    if (stored === "true") {
      document.documentElement.classList.add("dark");
    } else if (stored === "false") {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    refreshToken()
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, []);

  return (
    <ToastProvider>
      <Suspense fallback={<AppLoading />}><Routes>
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/boards" element={<ProtectedRoute><BoardsPage /></ProtectedRoute>} />
        <Route path="/global" element={<ProtectedRoute><GlobalBoardPage /></ProtectedRoute>} />
        <Route path="/board/:id" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense>
    </ToastProvider>
  );
}
