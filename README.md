# Customer Service Web Portal (React + Django + SQL Server)

This repo contains a full-stack starter for a multi-tenant customer‑service portal with JWT auth, role-based access, tickets, comments, attachments, and an org-scoped **Admin Dashboard**. It includes **Dockerized SQL Server** for local development.

## Stack

- **Frontend**: React (Vite), React Router, TanStack Query, Axios
- **Backend**: Django, DRF, SimpleJWT, drf-spectacular, CORS
- **DB**: SQL Server (via Docker)
- **DB Driver**: `mssql-django` + `ODBC Driver 18 for SQL Server`

---

## Quick Start

### 1) Start SQL Server (Docker)
```bash
docker compose up -d
```

### 2) Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy env and edit as needed
cp .env.example .env

# Migrations
python manage.py makemigrations
python manage.py migrate

# Create a superuser to log in
python manage.py createsuperuser

# Run API
python manage.py runserver 0.0.0.0:8000
```

> **ODBC Driver**: Make sure the machine running Django has **ODBC Driver 18 for SQL Server** installed.  
> Linux container snippet is included in the main answer; on Windows, install from Microsoft; on macOS use `brew install --cask msodbcsql18`.

### 3) Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Open the app at `http://localhost:5173`, API docs at `http://127.0.0.1:8000/api/docs/`.

---

## Environment

### backend/.env.example
```
DJANGO_SECRET=devsecret
DEBUG=True

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# DB
DB_NAME=csp
DB_USER=sa             # for dev you can use SA or create csp_user (recommended)
DB_PASSWORD=YourStrong!Passw0rd
DB_HOST=127.0.0.1
DB_PORT=1433
DB_BACKEND=mssql       # mssql or sqlite
```

### frontend/.env.example
```
VITE_API_BASE=http://127.0.0.1:8000/api
```

---

## Admin Dashboard

- Link appears if user role is **ADMIN** or **SUPERVISOR**.
- Endpoint: `/api/admin/stats/` with totals, status/priority breakdown, 7‑day trend, and top agents.
- Current chart is a lightweight bar chart (no heavy libs).

---

## Notes

- For production, consider **Azure SQL** and set DB encryption options (see backend settings).
- Create an `Organization` via Django admin, then set your user’s `organization` and role to **ADMIN**.
- Extend with SLA metrics, categories, canned replies, and exporting as needed.

Happy building!
