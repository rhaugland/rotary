import { NavLink } from "react-router-dom";
import AvocadoLogo from "./AvocadoLogo";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface SidebarProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  onWorkspaceChange: (ws: Workspace) => void;
  isAdmin: boolean;
  onLogout: () => void;
}

export default function Sidebar({ workspaces, currentWorkspace, onWorkspaceChange, isAdmin, onLogout }: SidebarProps) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-2 text-sm rounded-md transition-colors ${
      isActive
        ? "bg-guac-sidebar-hover text-white border-l-3 border-guac"
        : "text-cream-dark/70 hover:bg-guac-sidebar-hover hover:text-white"
    }`;

  return (
    <aside className="w-56 bg-guac-sidebar flex flex-col min-h-screen shrink-0">
      {/* Logo + Brand */}
      <div className="px-4 py-5 border-b border-white/10 flex items-center gap-3">
        <AvocadoLogo size={28} />
        <span className="text-white font-bold text-lg tracking-tight">Guac</span>
      </div>

      {/* Workspace Switcher */}
      <div className="px-4 py-3 border-b border-white/10">
        <select
          className="w-full bg-guac-sidebar-hover text-cream-dark/90 text-sm border border-white/10 rounded-md px-2 py-1.5 outline-none"
          value={currentWorkspace?.id ?? ""}
          onChange={(e) => {
            const ws = workspaces.find((w) => w.id === e.target.value);
            if (ws) onWorkspaceChange(ws);
          }}
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>{ws.name}</option>
          ))}
        </select>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {isAdmin ? (
          <>
            <NavLink to={`/w/${currentWorkspace?.slug}`} end className={linkClass}>Home</NavLink>
            <NavLink to={`/w/${currentWorkspace?.slug}/tasks`} className={linkClass}>Tasks</NavLink>
            <NavLink to={`/w/${currentWorkspace?.slug}/members`} className={linkClass}>Members</NavLink>
            <NavLink to={`/w/${currentWorkspace?.slug}/settings`} className={linkClass}>Settings</NavLink>
          </>
        ) : (
          <NavLink to={`/w/${currentWorkspace?.slug}`} end className={linkClass}>My Tasks</NavLink>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={onLogout}
          className="w-full text-left px-4 py-2 text-sm text-cream-dark/50 hover:text-cream-dark/80 transition-colors"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
