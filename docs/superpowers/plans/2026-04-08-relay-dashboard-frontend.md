# Relay Dashboard Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React SPA dashboard for the Relay task routing system, branded as "Guac" with cream/green avocado theming.

**Architecture:** Vite + React SPA served by the existing Express backend. React Router for client-side routing. Plain fetch with JWT auth wrapper for API calls. Tailwind CSS for styling with a custom Guac color palette (cream backgrounds, green accents). The Express server serves the built dashboard as static files at `/dashboard`.

**Tech Stack:** React 19, React Router 7, Vite 6, Tailwind CSS 4, TypeScript

---

## Branding: Guac Theme

- **Background:** Cream/off-white (`#FFF8F0`)
- **Surface:** White (`#FFFFFF`)
- **Sidebar:** Dark avocado green (`#1B3A2D`)
- **Primary accent:** Avocado green (`#4A7C59`)
- **Primary hover:** Darker green (`#3A6147`)
- **Status colors:** Green for done (`#4A7C59`), amber for overdue (`#D97706`), blue for open (`#3B82F6`), orange for in-progress (`#F59E0B`)
- **Text:** Dark brown (`#3D2B1F`) on light, cream on dark
- **Border:** Light tan (`#E8DDD0`)
- **Logo:** SVG avocado icon with "Guac" text

---

## File Structure

All frontend code lives in `dashboard/`:

```
dashboard/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.ts          — not needed with Tailwind v4 (uses CSS config)
  src/
    main.tsx                   — React entry point
    App.tsx                    — Router setup
    index.css                  — Tailwind imports + Guac theme variables
    api/
      client.ts                — Fetch wrapper with JWT auth
    hooks/
      useAuth.ts               — Auth state management (JWT, login, logout)
    pages/
      Login.tsx                — Magic link request form
      Verify.tsx               — Magic link token verification
      Invite.tsx               — Public onboarding form
      Dashboard.tsx            — Admin home (stats + tasks + activity)
      Tasks.tsx                — Full task list with filters
      Members.tsx              — Member list + invite management
      Settings.tsx             — Workspace name editing (admin)
    components/
      Layout.tsx               — Sidebar + main content shell
      Sidebar.tsx              — Navigation + workspace switcher
      StatsCards.tsx            — 4 stat boxes
      TaskList.tsx             — Reusable task table
      ActivityFeed.tsx         — Activity message list
      AvocadoLogo.tsx          — SVG avocado logo component
```

**Modified files:**
- `src/server.ts` — Add static file serving for `/dashboard`

---

### Task 1: Scaffold Dashboard Project

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/index.html`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/vite.config.ts`
- Create: `dashboard/src/main.tsx`
- Create: `dashboard/src/App.tsx`
- Create: `dashboard/src/index.css`

- [ ] **Step 1: Create `dashboard/package.json`**

```json
{
  "name": "guac-dashboard",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd /Users/ryanhaugland/relay/dashboard && npm install react react-dom react-router-dom && npm install --save-dev @types/react @types/react-dom typescript vite @vitejs/plugin-react tailwindcss @tailwindcss/vite`

- [ ] **Step 3: Create `dashboard/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `dashboard/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/dashboard/",
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
  },
});
```

- [ ] **Step 5: Create `dashboard/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Guac</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `dashboard/src/index.css`**

```css
@import "tailwindcss";

@theme {
  --color-cream: #FFF8F0;
  --color-cream-dark: #F5EDE3;
  --color-guac: #4A7C59;
  --color-guac-dark: #3A6147;
  --color-guac-sidebar: #1B3A2D;
  --color-guac-sidebar-hover: #244A38;
  --color-brown: #3D2B1F;
  --color-brown-light: #6B5344;
  --color-tan: #E8DDD0;
  --color-tan-light: #F0E8DE;
}

body {
  background-color: var(--color-cream);
  color: var(--color-brown);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
}
```

- [ ] **Step 7: Create `dashboard/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/dashboard">
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 8: Create `dashboard/src/App.tsx`**

```tsx
import { Routes, Route, Navigate } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<div className="p-8 text-brown">Guac Dashboard — Loading...</div>} />
    </Routes>
  );
}
```

- [ ] **Step 9: Verify it builds and runs**

Run: `cd /Users/ryanhaugland/relay/dashboard && npx vite build`
Expected: Build succeeds, output in `dashboard/dist/`

Run: `cd /Users/ryanhaugland/relay/dashboard && timeout 5 npx vite 2>&1 || true`
Expected: Dev server starts

- [ ] **Step 10: Commit**

```bash
git add dashboard/
git commit -m "feat: scaffold Guac dashboard with Vite, React, Tailwind"
```

---

### Task 2: API Client + Auth Hook

**Files:**
- Create: `dashboard/src/api/client.ts`
- Create: `dashboard/src/hooks/useAuth.ts`

- [ ] **Step 1: Create `dashboard/src/api/client.ts`**

```typescript
const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("guac_token");
}

export function setToken(token: string): void {
  localStorage.setItem("guac_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("guac_token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/dashboard/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export function get<T>(path: string): Promise<T> {
  return api<T>(path);
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function del<T>(path: string): Promise<T> {
  return api<T>(path, { method: "DELETE" });
}
```

- [ ] **Step 2: Create `dashboard/src/hooks/useAuth.ts`**

```typescript
import { useState, useEffect, useCallback } from "react";
import { get, setToken, clearToken } from "../api/client";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface User {
  id: string;
  name: string;
  preferredChannel: string;
  workspaces: Workspace[];
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await get<User>("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("guac_token");
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = useCallback((token: string) => {
    setToken(token);
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return { user, loading, login, logout, refetch: fetchUser };
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/ryanhaugland/relay/dashboard && npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/api/ dashboard/src/hooks/
git commit -m "feat: add API client with JWT auth and useAuth hook"
```

---

### Task 3: Avocado Logo + Layout Shell

**Files:**
- Create: `dashboard/src/components/AvocadoLogo.tsx`
- Create: `dashboard/src/components/Sidebar.tsx`
- Create: `dashboard/src/components/Layout.tsx`

- [ ] **Step 1: Create `dashboard/src/components/AvocadoLogo.tsx`**

```tsx
export default function AvocadoLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer avocado shape */}
      <ellipse cx="32" cy="36" rx="20" ry="26" fill="#4A7C59" />
      {/* Inner lighter flesh */}
      <ellipse cx="32" cy="38" rx="14" ry="19" fill="#C5D99E" />
      {/* Pit */}
      <circle cx="32" cy="42" r="8" fill="#6B4226" />
      {/* Pit highlight */}
      <circle cx="30" cy="40" r="2.5" fill="#8B5E3C" opacity="0.6" />
    </svg>
  );
}
```

- [ ] **Step 2: Create `dashboard/src/components/Sidebar.tsx`**

```tsx
import { NavLink, useParams } from "react-router-dom";
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
```

- [ ] **Step 3: Create `dashboard/src/components/Layout.tsx`**

```tsx
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
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/ryanhaugland/relay/dashboard && npx vite build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/
git commit -m "feat: add Guac avocado logo, sidebar, and layout shell"
```

---

### Task 4: Login + Verify Pages

**Files:**
- Create: `dashboard/src/pages/Login.tsx`
- Create: `dashboard/src/pages/Verify.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Create `dashboard/src/pages/Login.tsx`**

```tsx
import { useState } from "react";
import { post } from "../api/client";
import AvocadoLogo from "../components/AvocadoLogo";

export default function Login() {
  const [address, setAddress] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await post("/auth/request", { address });
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-tan p-8 w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-6">
          <AvocadoLogo size={40} />
          <h1 className="text-2xl font-bold text-brown">Guac</h1>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-guac text-4xl mb-3">✓</div>
            <h2 className="text-lg font-semibold text-brown mb-2">Check your messages</h2>
            <p className="text-brown-light text-sm">We sent a login link to your preferred channel.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-brown mb-1.5">
              Email or phone number
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="+1234567890 or you@email.com"
              className="w-full px-3 py-2 border border-tan rounded-lg text-brown bg-cream/50 focus:outline-none focus:ring-2 focus:ring-guac/30 focus:border-guac text-sm"
              required
            />
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            <button
              type="submit"
              className="w-full mt-4 bg-guac text-white py-2.5 rounded-lg font-medium hover:bg-guac-dark transition-colors text-sm"
            >
              Send login link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `dashboard/src/pages/Verify.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { post, setToken } from "../api/client";
import AvocadoLogo from "../components/AvocadoLogo";

interface VerifyProps {
  onLogin: (token: string) => void;
}

export default function Verify({ onLogin }: VerifyProps) {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    post<{ token: string; user: { id: string; name: string } }>("/auth/verify", { token })
      .then((data) => {
        onLogin(data.token);
        navigate("/");
      })
      .catch((err) => {
        setError(err.message || "Invalid or expired link");
      });
  }, [token, onLogin, navigate]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-tan p-8 w-full max-w-sm text-center">
        <AvocadoLogo size={40} />
        {error ? (
          <>
            <h2 className="text-lg font-semibold text-brown mt-4 mb-2">Link expired</h2>
            <p className="text-brown-light text-sm mb-4">{error}</p>
            <a href="/dashboard/login" className="text-guac text-sm hover:underline">Request a new link</a>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-brown mt-4 mb-2">Verifying...</h2>
            <p className="text-brown-light text-sm">Hang tight, logging you in.</p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `dashboard/src/App.tsx`**

```tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Verify from "./pages/Verify";

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
      <Route path="/invite/:token" element={<div>Invite page coming soon</div>} />

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
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/ryanhaugland/relay/dashboard && npx vite build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/pages/ dashboard/src/App.tsx
git commit -m "feat: add login and verify pages with Guac branding"
```

---

### Task 5: Public Invite/Onboarding Page

**Files:**
- Create: `dashboard/src/pages/Invite.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Create `dashboard/src/pages/Invite.tsx`**

```tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { get, post } from "../api/client";
import AvocadoLogo from "../components/AvocadoLogo";

export default function Invite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState("");
  const [valid, setValid] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [preferredChannel, setPreferredChannel] = useState("sms");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    get<{ valid: boolean; workspaceName?: string; reason?: string }>(`/invite/${token}`)
      .then((data) => {
        setValid(data.valid);
        if (data.valid && data.workspaceName) setWorkspaceName(data.workspaceName);
        if (!data.valid && data.reason) setReason(data.reason);
      })
      .catch(() => setValid(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await post(`/invite/${token}/join`, { name, preferredChannel, address });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to join");
    } finally {
      setSubmitting(false);
    }
  };

  const channelPlaceholders: Record<string, string> = {
    sms: "+1234567890",
    email: "you@example.com",
    google_chat: "you@company.com",
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-tan p-8 w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-6">
          <AvocadoLogo size={40} />
          <h1 className="text-2xl font-bold text-brown">Guac</h1>
        </div>

        {valid === null && <p className="text-center text-brown-light text-sm">Checking invite...</p>}

        {valid === false && (
          <div className="text-center">
            <h2 className="text-lg font-semibold text-brown mb-2">Invalid invite</h2>
            <p className="text-brown-light text-sm">{reason || "This invite link is no longer valid."}</p>
          </div>
        )}

        {valid && success && (
          <div className="text-center">
            <div className="text-guac text-4xl mb-3">✓</div>
            <h2 className="text-lg font-semibold text-brown mb-2">You're in!</h2>
            <p className="text-brown-light text-sm mb-4">Welcome to {workspaceName}.</p>
            <a href="/dashboard/login" className="text-guac text-sm hover:underline">Log in now</a>
          </div>
        )}

        {valid && !success && (
          <>
            <p className="text-center text-brown-light text-sm mb-4">
              Join <span className="font-semibold text-brown">{workspaceName}</span>
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-brown mb-1">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-tan rounded-lg text-brown bg-cream/50 focus:outline-none focus:ring-2 focus:ring-guac/30 focus:border-guac text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brown mb-1">Preferred channel</label>
                <select
                  value={preferredChannel}
                  onChange={(e) => setPreferredChannel(e.target.value)}
                  className="w-full px-3 py-2 border border-tan rounded-lg text-brown bg-cream/50 focus:outline-none focus:ring-2 focus:ring-guac/30 focus:border-guac text-sm"
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="google_chat">Google Chat</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brown mb-1">Contact</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={channelPlaceholders[preferredChannel]}
                  className="w-full px-3 py-2 border border-tan rounded-lg text-brown bg-cream/50 focus:outline-none focus:ring-2 focus:ring-guac/30 focus:border-guac text-sm"
                  required
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-guac text-white py-2.5 rounded-lg font-medium hover:bg-guac-dark transition-colors text-sm disabled:opacity-50"
              >
                {submitting ? "Joining..." : "Join workspace"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the invite route in `dashboard/src/App.tsx`**

Replace the placeholder invite route:

```tsx
<Route path="/invite/:token" element={<div>Invite page coming soon</div>} />
```

With:

```tsx
<Route path="/invite/:token" element={<Invite />} />
```

And add the import at the top:

```tsx
import Invite from "./pages/Invite";
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/ryanhaugland/relay/dashboard && npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/pages/Invite.tsx dashboard/src/App.tsx
git commit -m "feat: add public invite/onboarding page"
```

---

### Task 6: Reusable Components (StatsCards, TaskList, ActivityFeed)

**Files:**
- Create: `dashboard/src/components/StatsCards.tsx`
- Create: `dashboard/src/components/TaskList.tsx`
- Create: `dashboard/src/components/ActivityFeed.tsx`

- [ ] **Step 1: Create `dashboard/src/components/StatsCards.tsx`**

```tsx
interface Stat {
  label: string;
  value: number;
  color: string;
}

export default function StatsCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-xl border border-tan p-4 shadow-sm">
          <p className="text-xs font-medium text-brown-light uppercase tracking-wide">{stat.label}</p>
          <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `dashboard/src/components/TaskList.tsx`**

```tsx
interface Task {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  assignee?: { name: string };
  creator?: { name: string };
}

const statusStyles: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  done: "bg-green-50 text-green-700",
  overdue: "bg-red-50 text-red-700",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TaskList({ tasks, showAssignee = true }: { tasks: Task[]; showAssignee?: boolean }) {
  if (tasks.length === 0) {
    return <p className="text-brown-light text-sm py-4">No tasks found.</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-tan shadow-sm overflow-hidden">
      {tasks.map((task, i) => (
        <div key={task.id} className={`flex items-center justify-between px-4 py-3 ${i < tasks.length - 1 ? "border-b border-tan-light" : ""}`}>
          <div>
            <p className="text-sm font-medium text-brown">{task.title}</p>
            <p className="text-xs text-brown-light mt-0.5">
              {showAssignee && task.assignee ? task.assignee.name : task.creator ? `From ${task.creator.name}` : ""}
              {task.dueDate ? ` · Due ${formatDate(task.dueDate)}` : ""}
            </p>
          </div>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusStyles[task.status] ?? "bg-gray-50 text-gray-600"}`}>
            {task.status.replace("_", " ")}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `dashboard/src/components/ActivityFeed.tsx`**

```tsx
interface Activity {
  id: string;
  rawText: string;
  channel: string;
  direction: string;
  createdAt: string;
  user: { name: string };
  task?: { title: string } | null;
}

const channelIcons: Record<string, string> = {
  sms: "SMS",
  email: "Email",
  google_chat: "Chat",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="text-brown-light text-sm py-4">No recent activity.</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-tan shadow-sm">
      <h3 className="text-sm font-semibold text-brown px-4 pt-4 pb-2">Activity</h3>
      {activities.map((a, i) => (
        <div key={a.id} className={`px-4 py-2.5 ${i < activities.length - 1 ? "border-b border-tan-light" : ""}`}>
          <p className="text-sm text-brown">
            <span className="font-medium">{a.user.name}</span>{" "}
            {a.rawText.length > 60 ? a.rawText.slice(0, 60) + "..." : a.rawText}
          </p>
          <p className="text-xs text-brown-light mt-0.5">
            via {channelIcons[a.channel] ?? a.channel} · {timeAgo(a.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/ryanhaugland/relay/dashboard && npx vite build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/StatsCards.tsx dashboard/src/components/TaskList.tsx dashboard/src/components/ActivityFeed.tsx
git commit -m "feat: add StatsCards, TaskList, and ActivityFeed components"
```

---

### Task 7: Dashboard Home Page (Admin)

**Files:**
- Create: `dashboard/src/pages/Dashboard.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Create `dashboard/src/pages/Dashboard.tsx`**

```tsx
import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { get } from "../api/client";
import StatsCards from "../components/StatsCards";
import TaskList from "../components/TaskList";
import ActivityFeed from "../components/ActivityFeed";

interface DashboardData {
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
  memberCount: number;
  recentTasks: any[];
  recentActivity: any[];
}

export default function Dashboard() {
  const { currentWorkspace, isAdmin } = useOutletContext<{ currentWorkspace: { id: string; slug: string }; isAdmin: boolean }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    if (isAdmin) {
      get<DashboardData>(`/workspaces/${currentWorkspace.id}/dashboard`)
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      get<any[]>(`/workspaces/${currentWorkspace.id}/my-tasks`)
        .then(setMyTasks)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [currentWorkspace?.id, isAdmin]);

  if (loading) {
    return <p className="text-brown-light">Loading...</p>;
  }

  // Member view: show my tasks
  if (!isAdmin) {
    const openCount = myTasks.filter((t) => t.status !== "done").length;
    const dueThisWeek = myTasks.filter((t) => {
      if (!t.dueDate || t.status === "done") return false;
      const due = new Date(t.dueDate);
      const weekFromNow = new Date(Date.now() + 7 * 86400000);
      return due <= weekFromNow;
    }).length;
    const memberStats = [
      { label: "Assigned to Me", value: openCount, color: "text-blue-600" },
      { label: "Due This Week", value: dueThisWeek, color: "text-amber-600" },
    ];
    return (
      <div>
        <h1 className="text-xl font-bold text-brown mb-5">My Tasks</h1>
        <div className="max-w-md">
          <StatsCards stats={memberStats} />
        </div>
        <TaskList tasks={myTasks} showAssignee={false} />
      </div>
    );
  }

  // Admin view: full dashboard
  if (!data) return null;

  const stats = [
    { label: "Open", value: data.openTasks, color: "text-blue-600" },
    { label: "Overdue", value: data.overdueTasks, color: "text-red-600" },
    { label: "Completed", value: data.completedTasks, color: "text-guac" },
    { label: "Members", value: data.memberCount, color: "text-brown" },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-brown mb-5">Dashboard</h1>
      <StatsCards stats={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <h3 className="text-sm font-semibold text-brown mb-3">Recent Tasks</h3>
          <TaskList tasks={data.recentTasks} />
        </div>
        <div className="lg:col-span-2">
          <ActivityFeed activities={data.recentActivity} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `dashboard/src/App.tsx`**

Add the import:

```tsx
import Dashboard from "./pages/Dashboard";
```

Replace the placeholder route:

```tsx
<Route path="/w/:slug" element={<div className="text-brown">Dashboard home</div>} />
```

With:

```tsx
<Route path="/w/:slug" element={<Dashboard />} />
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/ryanhaugland/relay/dashboard && npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/pages/Dashboard.tsx dashboard/src/App.tsx
git commit -m "feat: add admin dashboard home page with stats and activity"
```

---

### Task 8: Tasks Page

**Files:**
- Create: `dashboard/src/pages/Tasks.tsx`
- Modify: `dashboard/src/App.tsx`

Note: The MyTasks view is handled inside Dashboard.tsx (Task 7) — it conditionally renders based on role. No separate MyTasks page needed.

- [ ] **Step 1: Create `dashboard/src/pages/Tasks.tsx`**

```tsx
import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { get } from "../api/client";
import TaskList from "../components/TaskList";

const statusFilters = ["all", "open", "in_progress", "overdue", "done"];

export default function Tasks() {
  const { currentWorkspace } = useOutletContext<{ currentWorkspace: { id: string } }>();
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    const query = filter !== "all" ? `?status=${filter}` : "";
    get<any[]>(`/workspaces/${currentWorkspace.id}/tasks${query}`)
      .then(setTasks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentWorkspace?.id, filter]);

  return (
    <div>
      <h1 className="text-xl font-bold text-brown mb-5">Tasks</h1>
      <div className="flex gap-2 mb-4">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
              filter === s
                ? "bg-guac text-white"
                : "bg-white text-brown-light border border-tan hover:border-guac/30"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-brown-light text-sm">Loading tasks...</p>
      ) : (
        <TaskList tasks={tasks} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `dashboard/src/App.tsx`**

Add import:

```tsx
import Tasks from "./pages/Tasks";
```

Replace the placeholder route:

```tsx
<Route path="/w/:slug/tasks" element={<div className="text-brown">Tasks page</div>} />
```

With:

```tsx
<Route path="/w/:slug/tasks" element={<Tasks />} />
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/ryanhaugland/relay/dashboard && npx vite build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/pages/Tasks.tsx dashboard/src/App.tsx
git commit -m "feat: add tasks list page with status filters"
```

---

### Task 9: Members Page with Invite Management

**Files:**
- Create: `dashboard/src/pages/Members.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Create `dashboard/src/pages/Members.tsx`**

```tsx
import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { get, post, del } from "../api/client";

interface Member {
  id: string;
  name: string;
  role: string;
  preferredChannel: string;
  joinedAt: string;
}

interface InviteLink {
  id: string;
  token: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  active: boolean;
  createdAt: string;
}

const channelLabels: Record<string, string> = {
  sms: "SMS",
  email: "Email",
  google_chat: "Google Chat",
};

export default function Members() {
  const { currentWorkspace, isAdmin } = useOutletContext<{ currentWorkspace: { id: string }; isAdmin: boolean }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    Promise.all([
      get<Member[]>(`/workspaces/${currentWorkspace.id}/members`),
      isAdmin ? get<InviteLink[]>(`/workspaces/${currentWorkspace.id}/invites`) : Promise.resolve([]),
    ])
      .then(([m, i]) => { setMembers(m); setInvites(i); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentWorkspace?.id, isAdmin]);

  const createInvite = async () => {
    try {
      const invite = await post<{ id: string; token: string; url: string }>(`/workspaces/${currentWorkspace.id}/invites`, {});
      setInvites((prev) => [{ ...invite, expiresAt: null, maxUses: null, useCount: 0, active: true, createdAt: new Date().toISOString() } as InviteLink, ...prev]);
    } catch (err) {
      console.error("Failed to create invite:", err);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    try {
      await del(`/workspaces/${currentWorkspace.id}/invites/${inviteId}`);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      console.error("Failed to revoke invite:", err);
    }
  };

  const copyInviteUrl = (token: string, id: string) => {
    const url = `${window.location.origin}/dashboard/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return <p className="text-brown-light text-sm">Loading...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-brown mb-5">Members</h1>

      {/* Member List */}
      <div className="bg-white rounded-xl border border-tan shadow-sm overflow-hidden mb-8">
        {members.map((m, i) => (
          <div key={m.id} className={`flex items-center justify-between px-4 py-3 ${i < members.length - 1 ? "border-b border-tan-light" : ""}`}>
            <div>
              <p className="text-sm font-medium text-brown">{m.name}</p>
              <p className="text-xs text-brown-light mt-0.5">
                {channelLabels[m.preferredChannel] ?? m.preferredChannel} · Joined {new Date(m.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
              m.role === "admin" ? "bg-guac/10 text-guac" : "bg-tan-light text-brown-light"
            }`}>
              {m.role}
            </span>
          </div>
        ))}
      </div>

      {/* Invite Management (admin only) */}
      {isAdmin && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-brown">Invite Links</h2>
            <button
              onClick={createInvite}
              className="bg-guac text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-guac-dark transition-colors"
            >
              + New Invite
            </button>
          </div>

          {invites.length === 0 ? (
            <p className="text-brown-light text-sm">No active invite links.</p>
          ) : (
            <div className="bg-white rounded-xl border border-tan shadow-sm overflow-hidden">
              {invites.map((inv, i) => (
                <div key={inv.id} className={`flex items-center justify-between px-4 py-3 ${i < invites.length - 1 ? "border-b border-tan-light" : ""}`}>
                  <div>
                    <p className="text-sm font-mono text-brown-light">{inv.token.slice(0, 20)}...</p>
                    <p className="text-xs text-brown-light mt-0.5">
                      Used {inv.useCount} time{inv.useCount !== 1 ? "s" : ""}
                      {inv.maxUses ? ` / ${inv.maxUses} max` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyInviteUrl(inv.token, inv.id)}
                      className="text-xs px-3 py-1.5 rounded-md border border-tan text-brown-light hover:border-guac hover:text-guac transition-colors"
                    >
                      {copiedId === inv.id ? "Copied!" : "Copy link"}
                    </button>
                    <button
                      onClick={() => revokeInvite(inv.id)}
                      className="text-xs px-3 py-1.5 rounded-md border border-tan text-red-500 hover:border-red-300 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `dashboard/src/App.tsx`**

Add import:

```tsx
import Members from "./pages/Members";
```

Replace the placeholder:

```tsx
<Route path="/w/:slug/members" element={<div className="text-brown">Members page</div>} />
```

With:

```tsx
<Route path="/w/:slug/members" element={<Members />} />
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/ryanhaugland/relay/dashboard && npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/pages/Members.tsx dashboard/src/App.tsx
git commit -m "feat: add members page with invite link management"
```

---

### Task 10: Settings Page

**Files:**
- Create: `dashboard/src/pages/Settings.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Create `dashboard/src/pages/Settings.tsx`**

```tsx
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/client";

export default function Settings() {
  const { currentWorkspace, isAdmin } = useOutletContext<{
    currentWorkspace: { id: string; name: string; slug: string };
    isAdmin: boolean;
  }>();
  const [name, setName] = useState(currentWorkspace?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-xl font-bold text-brown mb-5">Settings</h1>
        <p className="text-brown-light text-sm">Only admins can edit workspace settings.</p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api(`/workspaces/${currentWorkspace.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setSaved(true);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-brown mb-5">Settings</h1>
      <div className="bg-white rounded-xl border border-tan shadow-sm p-6 max-w-md">
        <form onSubmit={handleSave}>
          <label className="block text-sm font-medium text-brown mb-1.5">Workspace name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-tan rounded-lg text-brown bg-cream/50 focus:outline-none focus:ring-2 focus:ring-guac/30 focus:border-guac text-sm"
            required
          />
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-guac text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-guac-dark transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {saved && <span className="text-guac text-sm">Saved!</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `dashboard/src/App.tsx`**

Add import:

```tsx
import Settings from "./pages/Settings";
```

Add route inside the `<Route element={<Layout ... />}>` group, after the members route:

```tsx
<Route path="/w/:slug/settings" element={<Settings />} />
```

- [ ] **Step 3: Update Sidebar to include Settings link**

In `dashboard/src/components/Sidebar.tsx`, add a Settings link in the nav for admins (after Members) and for members (after My Tasks):

In the admin section, add after the Members NavLink:

```tsx
<NavLink to={`/w/${currentWorkspace?.slug}/settings`} className={linkClass}>Settings</NavLink>
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/ryanhaugland/relay/dashboard && npx vite build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/pages/Settings.tsx dashboard/src/App.tsx dashboard/src/components/Sidebar.tsx
git commit -m "feat: add workspace settings page for name editing"
```

---

### Task 11: Serve Dashboard from Express + Build

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add static file serving to `src/server.ts`**

Add this import at the top:

```typescript
import path from "path";
import { fileURLToPath } from "url";
```

Add these routes after the API route mounts (after the `app.use("/api", invitesRouter);` line), before the `// Start server` comment:

```typescript
// Serve dashboard static files
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardPath = path.join(__dirname, "..", "dashboard", "dist");
app.use("/dashboard", express.static(dashboardPath));
app.get("/dashboard/*", (_req, res) => {
  res.sendFile(path.join(dashboardPath, "index.html"));
});
```

Note: If `import.meta.url` doesn't work in the CommonJS setup, use this instead:

```typescript
const dashboardPath = path.join(process.cwd(), "dashboard", "dist");
app.use("/dashboard", express.static(dashboardPath));
app.get("/dashboard/*", (_req, res) => {
  res.sendFile(path.join(dashboardPath, "index.html"));
});
```

Use `process.cwd()` since the project uses `"type": "commonjs"` in package.json.

- [ ] **Step 2: Build the dashboard**

Run: `cd /Users/ryanhaugland/relay/dashboard && npm run build`
Expected: Build succeeds, files in `dashboard/dist/`

- [ ] **Step 3: Add `dashboard/dist` to `.gitignore`**

Append to `/Users/ryanhaugland/relay/.gitignore`:

```
dashboard/dist/
dashboard/node_modules/
```

- [ ] **Step 4: Run backend tests to make sure nothing broke**

Run: `cd /Users/ryanhaugland/relay && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/server.ts .gitignore
git commit -m "feat: serve dashboard static files from Express"
```

---
