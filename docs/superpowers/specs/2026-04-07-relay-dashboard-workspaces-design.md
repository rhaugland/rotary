# Relay Dashboard & Workspaces Design Spec

## Overview

Add workspaces (project-scoped, multi-membership) and a web dashboard to Relay. Users self-onboard via invite links, authenticate via magic links sent to their preferred channel, and manage tasks through a React SPA. Admins see a full overview dashboard; members see their own tasks.

## Data Model

### New Models

**Workspace**
- `id` (UUID, primary key)
- `name` (string, required)
- `slug` (string, unique — URL-friendly identifier)
- `createdAt`, `updatedAt`
- Relations: `members` (WorkspaceMember[]), `tasks` (Task[]), `inviteLinks` (InviteLink[])

**WorkspaceMember** (join table)
- `id` (UUID)
- `workspaceId` (foreign key → Workspace)
- `userId` (foreign key → User)
- `role` (enum: `admin`, `member` — default `member`)
- `joinedAt` (datetime)
- Unique constraint on `(workspaceId, userId)`
- Relations: `workspace` (Workspace), `user` (User)

**InviteLink**
- `id` (UUID)
- `workspaceId` (foreign key → Workspace)
- `token` (string, unique — random URL-safe string)
- `createdById` (foreign key → User)
- `expiresAt` (datetime, optional)
- `maxUses` (int, optional — null means unlimited)
- `useCount` (int, default 0)
- `active` (boolean, default true)
- `createdAt`
- Relations: `workspace` (Workspace), `createdBy` (User)

**MagicLink**
- `id` (UUID)
- `userId` (foreign key → User)
- `token` (string, unique)
- `expiresAt` (datetime — 15 minutes from creation)
- `used` (boolean, default false)
- `createdAt`
- Relations: `user` (User)

### Changes to Existing Models

**Task**
- Add `workspaceId` (foreign key → Workspace, required)
- Add relation: `workspace` (Workspace)

**User**
- Add relation: `memberships` (WorkspaceMember[])
- Add relation: `magicLinks` (MagicLink[])
- Add relation: `createdInvites` (InviteLink[])

### New Enum

**WorkspaceRole**: `admin`, `member`

## Authentication

### Magic Link Flow

1. User visits `/login`, enters their email or phone number
2. Server looks up UserAddress, finds the user, creates a MagicLink (token + 15-min expiry)
3. Server sends the magic link URL to the user via their preferred channel (SMS, email, or Google Chat) using the existing adapter system
4. User clicks the link → hits `/verify/:token`
5. Server validates token (exists, not expired, not used), marks it used, returns a JWT
6. JWT contains `userId` and is stored in localStorage
7. All subsequent API requests include `Authorization: Bearer <jwt>`

### JWT Structure

- `userId` (UUID)
- `iat` (issued at)
- `exp` (24-hour expiry)

No workspace info in the JWT — workspace context comes from the URL path.

### Authorization Rules

- Any authenticated user can create a workspace (they become admin)
- Workspace endpoints require the user to be a member of that workspace
- Admin-only endpoints (invites, member management) check `WorkspaceMember.role === 'admin'`
- Public endpoints: invite validation (`GET /api/invite/:token`) and joining (`POST /api/invite/:token/join`)

## API Endpoints

### Auth (public)

**POST /api/auth/request**
- Body: `{ address: string }` (email or phone)
- Looks up user by address, creates MagicLink, sends via preferred channel
- Returns: `{ sent: true }` (always, to prevent user enumeration)

**POST /api/auth/verify**
- Body: `{ token: string }`
- Validates magic link, returns JWT
- Returns: `{ token: string, user: { id, name } }`

**GET /api/auth/me** (authenticated)
- Returns current user with workspaces list
- Returns: `{ id, name, preferredChannel, workspaces: [{ id, name, slug, role }] }`

### Workspaces (authenticated)

**POST /api/workspaces**
- Body: `{ name: string }`
- Creates workspace, generates slug from name, adds creator as admin
- Returns: `{ id, name, slug }`

**GET /api/workspaces**
- Lists all workspaces the current user belongs to
- Returns: `[{ id, name, slug, role, memberCount, openTaskCount }]`

### Workspace-Scoped (authenticated + member of workspace)

**GET /api/workspaces/:id/dashboard**
- Returns: `{ openTasks, overdueTasks, completedTasks, memberCount, recentTasks: Task[], recentActivity: Activity[] }`

**GET /api/workspaces/:id/tasks?status=open&assignee=userId**
- Filterable task list
- Returns: `Task[]` with assignee and creator populated

**GET /api/workspaces/:id/members**
- Returns: `[{ id, name, role, preferredChannel, joinedAt }]`

**GET /api/workspaces/:id/activity**
- Recent messages and task state changes
- Returns: `[{ type, description, user, channel, timestamp }]`

**GET /api/workspaces/:id/my-tasks**
- Current user's tasks only in this workspace
- Returns: `Task[]`

### Invites (authenticated + admin)

**POST /api/workspaces/:id/invites**
- Body: `{ expiresAt?: string, maxUses?: number }`
- Generates invite token
- Returns: `{ id, token, url, expiresAt, maxUses }`

**GET /api/workspaces/:id/invites**
- Lists active invite links
- Returns: `InviteLink[]`

**DELETE /api/workspaces/:id/invites/:inviteId**
- Deactivates invite link

### Onboarding (public)

**GET /api/invite/:token**
- Validates invite (exists, active, not expired, under max uses)
- Returns: `{ valid: true, workspaceName: string }` or `{ valid: false, reason: string }`

**POST /api/invite/:token/join**
- Body: `{ name: string, preferredChannel: Channel, address: string }`
- Creates user (or finds existing by address), creates WorkspaceMember, increments useCount
- If user already exists and is already a member, returns success without duplicating
- Returns: `{ user: { id, name }, workspace: { id, name, slug } }`

## Frontend

### Tech Stack

- React 19 + React Router
- Vite (build tool)
- Tailwind CSS (styling)
- Plain fetch with a small auth wrapper for API calls

### Directory Structure

All frontend code lives in `relay/dashboard/`:

```
dashboard/
  index.html
  src/
    main.tsx
    App.tsx
    api/            — fetch wrappers with auth headers
      client.ts
    pages/
      Login.tsx
      Verify.tsx
      Invite.tsx
      Dashboard.tsx
      Tasks.tsx
      Members.tsx
      MyTasks.tsx
      Settings.tsx
    components/
      Sidebar.tsx
      StatsCards.tsx
      TaskList.tsx
      ActivityFeed.tsx
      InviteManager.tsx
      OnboardingForm.tsx
    hooks/
      useAuth.ts
      useWorkspace.ts
```

### Pages

**`/login`** — Input field for email or phone. Submit sends magic link. Shows "Check your [channel] for a login link" message.

**`/verify/:token`** — Landing page from magic link. Validates token, stores JWT, redirects to `/`.

**`/invite/:token`** — Public page. Shows workspace name and a form: name, preferred channel (dropdown: SMS/Email/Google Chat), contact address. Submit joins the workspace and redirects to login.

**`/`** — Redirects to `/w/:slug` for the user's first workspace. If user has no workspaces, shows "Create a workspace" prompt.

**`/w/:slug`** (admin) — Dashboard home. Stats cards (open, overdue, completed, members). Recent tasks list. Activity feed showing channel indicators.

**`/w/:slug`** (member) — My Tasks view. Stats (assigned to me, due this week). Task list filtered to current user.

**`/w/:slug/tasks`** (admin) — Full task list with status filter tabs (All, Open, In Progress, Overdue, Done) and assignee filter.

**`/w/:slug/members`** (admin) — Member list with name, role, preferred channel, joined date. Invite link generation and management section.

**`/w/:slug/settings`** (admin) — Workspace name editing.

### Layout

- Dark sidebar (persistent): workspace switcher dropdown at top, navigation links below. Admin sees: Home, Tasks, Members, Settings. Member sees: My Tasks, Settings.
- Main content area with light background.
- Top nav bar within main content shows current page title.

### Serving the SPA

Express serves the built dashboard as static files. Add a catch-all route for client-side routing:

```
app.use('/dashboard', express.static('dashboard/dist'))
app.get('/dashboard/*', (req, res) => res.sendFile('dashboard/dist/index.html'))
```

All dashboard routes are prefixed with `/dashboard` to avoid conflicting with API and webhook routes.

## Router Integration

### Task Workspace Scoping

When a user creates a task via SMS/email/chat:
1. Resolve sender identity (existing flow)
2. Look up sender's workspace memberships
3. If sender is in **one workspace** — task is created in that workspace
4. If sender is in **multiple workspaces** — Relay replies "Which workspace?" with a numbered list. User replies with the number. Store the selection in the threading map for future tasks in that conversation.
5. Resolve the assignee — they must be a member of the same workspace. If not found, reply "I couldn't find [name] in [workspace]."

### Outbound Notifications

No changes to notification delivery. The workspace name is included in formatted task messages for context (e.g., "[W3 Digital] New task: Finish logo design — due Apr 10").

### Scheduler Updates

- Overdue checks, daily reminders, and due date warnings include workspace name in messages
- Queries filter by workspace when fetching tasks

## Implementation Plans

This spec is split into two implementation plans:

1. **Backend** — Prisma schema migration, auth system, workspace API endpoints, invite/onboarding flow, router integration for workspace scoping
2. **Frontend** — React SPA with all pages and components

Backend is built first since the frontend depends on the API.

## Out of Scope

- Real-time updates (WebSocket/SSE) — polling or manual refresh
- File attachments or rich media in tasks
- Workspace deletion — deactivate invites and remove members manually
- Role changes via dashboard — admin sets roles at the database level for now
- Password-based auth — magic links only
- OAuth/SSO — magic links only
