import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Verify from "./pages/Verify";
import Invite from "./pages/Invite";

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
          <Route path="/w/:slug" element={<div className="text-brown">Dashboard home</div>} />
          <Route path="/w/:slug/tasks" element={<div className="text-brown">Tasks page</div>} />
          <Route path="/w/:slug/members" element={<div className="text-brown">Members page</div>} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
