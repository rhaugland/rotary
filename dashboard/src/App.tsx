import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Verify from "./pages/Verify";
import Invite from "./pages/Invite";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Members from "./pages/Members";
import Settings from "./pages/Settings";

export default function App() {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-brown-light">Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/verify/:token" element={<Verify onLogin={login} />} />
      <Route path="/invite/:token" element={<Invite />} />

      {user ? (
        <Route element={<Layout user={user} onLogout={logout} />}>
          <Route path="/" element={<Navigate to={`/w/${user.workspaces[0]?.slug ?? ""}`} replace />} />
          <Route path="/w/:slug" element={<Dashboard />} />
          <Route path="/w/:slug/tasks" element={<Tasks />} />
          <Route path="/w/:slug/members" element={<Members />} />
          <Route path="/w/:slug/settings" element={<Settings />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
