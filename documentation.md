Here’s a “big-picture but detailed” tour of your customer-service portal—what lives where, why it’s there, and how the pieces fit.

# System Overview

* **Frontend**: React + Vite, Tailwind CSS, React Query, Axios, Recharts.
  Goal: a fast, modern SPA with clean UI primitives, smart caching, and minimal hand-rolled state management.
* **Backend**: Django + Django REST Framework (DRF) + SimpleJWT.
  Goal: robust, multi-tenant API with clear authorization, strong defaults, and the ergonomics of DRF viewsets.
* **Database**: SQL Server (via `pyodbc`/`mssql-django`).
  Goal: use SQL Server locally or in Docker; Django’s ORM handles the rest.

Multi-tenancy is **organization-scoped**: every record belongs to exactly one org, and permissions enforce “see only what you should.”

---

# Data Model (Core Entities)

* **Organization**

  * `name` (unique), optional `domain`, and an `invite_code` used to **join** an org at signup.
  * `invite_code` is generated per-row via a callable default (`gen_invite_code()`), so each org gets a unique code.
* **User (custom `accounts.User`)**

  * Extends Django `AbstractUser`, adds:
  * `organization` FK → Organization
  * `role` in `{ADMIN, SUPERVISOR, AGENT}`
* **Group** (in tickets)

  * Belongs to an Organization; optional `manager` (User).
* **GroupMembership** (in tickets)

  * Many-to-many bridge: User ∈ Group (and thus ∈ Organization).
* **Ticket** (in tickets)

  * `organization`, optional `group`, `created_by`, optional `assignee`, `status`, `priority`, timestamps.
  * Visibility rules (below) encode your business logic.
* **Comment / Attachment** (in tickets)

  * Basic discussion and file metadata tied to a Ticket.

**Why this shape?**
It’s the smallest set of tables that gives you:

* org-level isolation,
* team routing (Group + Membership),
* role-based responsibilities,
* and ticket lifecycle, without overfitting to a single workflow.

---

# Backend

## Technology Choices (Why)

* **Django + DRF**: fast to build, clear separation (models/serializers/views), batteries-included admin, and powerful permission hooks.
* **SimpleJWT**: stateless auth; avoids CSRF complexities; plays well with React SPAs.
* **ViewSets + Routers**: consistent, concise REST endpoints; `@action` methods for custom verbs without inventing new controllers.

## Auth & Permissions

* **JWT endpoints**
  `/api/token/`, `/api/token/refresh/`, `/api/token/verify/` (SimpleJWT).
  Frontend stores tokens and sends `Authorization: Bearer <access>`.

* **Default DRF settings**

  * `DEFAULT_AUTHENTICATION_CLASSES`: JWT.
  * `DEFAULT_PERMISSION_CLASSES`: `IsAuthenticated` (tight default).
  * CORS allows your frontend origin (so the SPA can call the API).

* **Permission classes**

  * `IsOrgAdmin`: grants access when user’s `role ∈ {ADMIN, SUPERVISOR}`. Lives in `accounts/permissions.py`.
  * Others (like `IsSameOrg`, `IsSupervisorOrOwner`) restrict per-object access—these enforce that the object’s `organization` equals `request.user.organization` and that the actor is allowed by role or ownership.

**Why**: permissions live at the API layer (not just UI) so anything calling the API is enforced consistently.

## Org Scoping

* **`OrgScopedMixin`**

  * Implements `get_queryset()` to automatically filter by `request.user.organization`.
  * Used by all “org resources” (users, groups, memberships, tickets, comments, attachments).
  * `perform_create()` sets `organization` and `created_by` automatically.

**Why**: this guarantees multi-tenancy safety by default. You won’t “forget” to filter; it’s built in.

## Accounts App

* **`accounts/models.py`**

  * `Organization` with callable `invite_code` default (and a `rotate_invite()` helper).
  * `User` with `organization` and `role`.

* **Migrations for `invite_code`**

  * You used a **three-step** migration to add a UNIQUE, NOT NULL field safely:

    1. Add nullable, non-unique column.
    2. Data migration to populate unique codes for existing rows.
    3. Alter field to `unique=True` with callable default.
  * **Why**: avoids uniqueness problems when adding a new required field to a non-empty table, and works cleanly with SQL Server.

* **Signup / Register flow**

  * **`RegisterView`** (`/api/register/`): one endpoint supports **create org** (`organization_name`) or **join org** (`organization_code`). The creator becomes `ADMIN`; joiners default to `AGENT` (or explicit role if allowed).
  * **`SignupView`** (optional, guarded by `ALLOW_SIGNUP`): a simpler public endpoint if you want to toggle open signups.
  * **`MeView`** (`/api/me/`): identity and org metadata for the SPA.

* **Org Admin Users**

  * **`OrgUserViewSet`** (`/api/org-admin/users/`): CRUD users **within the caller’s org**, hidden superusers/staff.
  * `OrgUserSerializer` allows updating `role` and `is_active` via `PATCH`.

**Why**: org admins can manage their people without ever entering Django’s global admin.

## Tickets App

* **Visibility Rules (Business Logic)**

  * **Admins/Supervisors**: see all tickets in their org.
  * **Agents & Others**:

    * Always see tickets they **created**.
    * See tickets **assigned to them**.
    * If **unassigned**: only the group’s **manager** sees it.
    * If **assigned**: all **members of that group** see it.
  * Implemented in `TicketViewSet.get_queryset()` combining org filter + role/relationship filters.

* **Actions**

  * `POST /api/tickets/:id/assign/` — only group manager or org admin/supervisor may assign; assignee must be a member of the ticket’s group.
  * `POST /api/tickets/:id/close/` — assignee can close with a comment; author sees resolution + comment.

* **Org Admin for Groups**

  * **`OrgGroupViewSet`** (`/api/org-admin/groups/`):

    * `GET :id/members/`: list members of a group.
    * `POST :id/set-manager/`: set a new manager (user must be in the same org).
    * `POST/DELETE :id/members/:user_id/`: add/remove members.
  * **Why actions?** They’re natural verbs on the group resource (fits REST better than inventing separate controllers).

* **Stats**

  * **`AdminStatsView`**: org-wide totals, by status & priority, last-7-days histogram, and top assignees.
  * **`MyStatsView`** (optional): self-scoped stats for non-admins.
  * **Why**: gives the dashboard something cheap, fast, and useful to show without exposing raw ticket lists everywhere.

## URLs (Core)

* JWT: `/api/token/`, `/api/token/refresh/`, `/api/token/verify/`
* Identity: `/api/me/`
* Tickets: `/api/tickets/` (CRUD), `/:id/assign/`, `/:id/close/`
* Groups: `/api/groups/` (org-scoped)
* Org Admin:

  * `/api/org-admin/users/` (CRUD, role/active changes)
  * `/api/org-admin/groups/` (CRUD, `members/`, `set-manager/`, `members/:user_id/`)
  * `/api/org-admin/memberships/` (direct membership CRUD if needed)
* Stats: `/api/admin/stats/` (admins), `/api/my/stats/` (agents)
* Signup/Register: `/api/register/` (create/join org), `/api/signup/` (optional)

---

# Frontend

## Technology Choices (Why)

* **React + Vite**: fast HMR, modern build tool; perfect for SPAs.
* **Tailwind**: utility-first styling; consistent spacing/typography; effortless dark mode via `dark:` variants.
* **React Query**: cache + dedupe + background refresh of API calls with very little code—beats manual Redux slices for this use case.
* **Axios**: request/response interceptors for JWT refresh, a single base URL, and JSON everywhere.
* **Recharts**: accessible, responsive charting with animation out of the box.

## Data & Network Layer

* **`api/axios.js`**

  * Base URL set to your backend (`/api`).
  * Interceptors:

    * Attach `Authorization` header from localStorage.
    * On `401` with expired access token, automatically **refresh** once with `/api/token/refresh/` and retry the original request.
    * Dedupes refresh calls (optional improvement): only one refresh in flight; others wait—reduces “thundering herd”.

* **React Query defaults (per query)**

  * `retry: false` for views where retries cause visible lag or 403 spam.
  * `refetchOnWindowFocus: false` to prevent noisy refetch loops.
  * `staleTime` set where appropriate (stats) to avoid recomputing too often.

**Why**: this makes the app feel snappy and avoids the “retry storm” you saw.

## App Structure (Key Pages)

* **Auth**

  * **Login** uses `/api/token/`.
  * **SignUp** supports “Create org” (becomes ADMIN) or “Join org” via invite code. Stores tokens and redirects.

* **Home / Dashboard**

  * Friendly welcome + quick actions + “recent tickets” table.
  * Uses react-query to fetch `/tickets?ordering=-created_at&page_size=…` and shows a small status badge, assignee, group, timestamp.
  * Dark mode friendly (uses `currentColor` in charts/badges).

* **Admin Dashboard (Org Admin merged)**

  * Tabs: **Overview, Users, Groups, Memberships**
  * **Overview**: pulls `/api/admin/stats/` (falls back to `/api/my/stats/` for non-admins if you added that) and renders KPIs + animated bar chart + priority panel + top agents list.
  * **Users**: shows list of users in your org, inline **role dropdown** and **active** toggle.

    * PATCH `/api/org-admin/users/:id/` on change.
  * **Groups**:

    * Group list on the left (name + current manager).
    * On select: **change manager** (POST `/set-manager/`) and **members** list with **Add/Remove** buttons (POST/DELETE `/members/:user_id/`).
  * All admin tabs are **disabled for non-admins** (UI), and blocked by **`IsOrgAdmin`** (API).

* **Tickets**

  * **New / Edit**: form assigns to a group; managers can assign the ticket to a user in that group.
  * **Detail**: assignee can **Close** with a comment; requester sees status + resolution comment.
  * **Visibility** mirrors the backend logic—frontend only aids UX; server enforces the rules.

**Why this UX?**
Admins get a one-stop internal “mini admin” without handing out superuser privileges, and agents get just what they need: create, see, work, and close tickets.

## UI Conventions

* **Cards & Spacing**: common classes `card card-p`, `page-title`, `btn`, `input`, `select` keep the app coherent.
* **Dark Mode**: all colors derive from Tailwind tokens with `dark:` variants; charts use `currentColor` so they adapt automatically.
* **Tables**: responsive, sticky header (where used), hover rows, and minimal borders for readability.

---

# Security Model (What’s enforced where)

* **API is the source of truth.** UI hides what you can’t do, but the server blocks it anyway.
* **JWT**: short-lived access tokens + refresh tokens. No cookies required (CSRF not needed with Authorization header).
* **Org Isolation**: `OrgScopedMixin` + custom permissions ensure every query and mutation is filtered/scoped.
* **Role Gates**:

  * `IsOrgAdmin` for `/org-admin/...` and `/admin/stats/`.
  * Ticket actions check ownership/role: only group managers/admins assign; only assignees close; only group members see assigned tickets; only the manager sees unassigned tickets.

---

# Operational Notes & Troubleshooting

* **Invite Code Migration**: the three-step process avoids unique-constraint failures. If you see `Callable default on unique field ...`, you skipped the populate step.
* **JWT 404s**: add SimpleJWT views to `core/urls.py` (`/api/token/`, `/refresh/`, `/verify/`).
* **403/404 Loops on Dashboard**: disable retries on stats queries and add a fallback to `/api/my/stats/` to avoid noisy logs and long load times.
* **MSSQL ODBC IM002**: install a SQL Server ODBC driver and verify the connection string in `DATABASES`. The Dockerized SQL Server + `mssql-django` avoids Windows DSN pitfalls.
* **Tailwind “unknown utility”**: ensure Tailwind is initialized, content paths include your `src/**/*`, and you’re not accidentally running CSS modules without `@reference`.

---

# Extensibility (Things you can add next)

* **Org Settings panel**: display/copy `invite_code` + “Rotate code” button (POST to an endpoint that calls `Organization.rotate_invite()`).
* **Email invites**: instead of sharing raw codes, send time-limited invite links.
* **Notifications**: email/Slack on assignment/resolution.
* **SLA & Metrics**: add due dates, first response time, time to close, and dashboards by group.
* **Audit Log**: model changes (who did what when) for compliance.
* **File storage**: S3/Azure Blob for attachments with presigned URLs.

---

# API Quick Map (for reference)

* **Auth**

  * `POST /api/token/ {username, password}`
  * `POST /api/token/refresh/ {refresh}`
  * `GET /api/me/`
* **Signup**

  * `POST /api/register/`
    Create org: `{ username, password, ..., organization_name }`
    Join org: `{ username, password, ..., organization_code }`
* **Tickets**

  * `GET/POST /api/tickets/`
  * `GET/PATCH/DELETE /api/tickets/:id/`
  * `POST /api/tickets/:id/assign/ { assignee: <user_id> }`
  * `POST /api/tickets/:id/close/ { comment: "…" }`
* **Groups**

  * `GET/POST /api/groups/` (org-scoped)
* **Org Admin**

  * `GET/POST/PATCH/DELETE /api/org-admin/users/` (+ `/:id/`)
  * `GET/POST/PATCH/DELETE /api/org-admin/groups/` (+ `/:id/`)
  * `GET /api/org-admin/groups/:id/members/`
  * `POST /api/org-admin/groups/:id/set-manager/ { manager: <user_id> }`
  * `POST /api/org-admin/groups/:id/members/:user_id/` (add)
  * `DELETE /api/org-admin/groups/:id/members/:user_id/` (remove)
  * (Optionally) `GET/POST/DELETE /api/org-admin/memberships/`

---

# Why These Choices Work Well

* **Least surprise**: DRF viewsets + routers match common REST patterns; future hires will be comfortable here.
* **Defense in depth**: permissions on the API, not just the UI.
* **Multi-tenancy by construction**: `OrgScopedMixin` eliminates a whole class of “forgot to filter by org” bugs.
* **Developer ergonomics**: Tailwind for fast UI iterations; React Query for effortless data fetching; Axios for predictable auth flow.
* **Performance**: avoiding noisy retries and focusing refetch behavior keeps UI responsive (you saw the difference in logs immediately).

If you want, I can bundle this into a `README.md` for the repo with copy-paste setup commands and a “First Run” section.
