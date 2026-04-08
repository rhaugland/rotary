import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useState, useEffect } from "react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface LayoutProps {
  user: { id: string; name: string; workspaces: Workspace[] };
  onLogout: () => void;
}

export default function Layout({ user, onLogout }: LayoutProps) {
  const navigate = useNavigate();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    if (user.workspaces.length > 0 && !currentWorkspace) {
      setCurrentWorkspace(user.workspaces[0]);
    }
  }, [user.workspaces, currentWorkspace]);

  const isAdmin = currentWorkspace?.role === "admin";

  const handleWorkspaceChange = (ws: Workspace) => {
    setCurrentWorkspace(ws);
    navigate(`/w/${ws.slug}`);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        workspaces={user.workspaces}
        currentWorkspace={currentWorkspace}
        onWorkspaceChange={handleWorkspaceChange}
        isAdmin={isAdmin}
        onLogout={onLogout}
      />
      <main className="flex-1 bg-cream p-6 overflow-auto">
        <Outlet context={{ user, currentWorkspace, isAdmin }} />
      </main>
    </div>
  );
}
