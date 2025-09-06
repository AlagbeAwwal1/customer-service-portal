// src/pages/Dashboard.jsx
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";

export default function Dashboard() {
  // who am I?
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/me/")).data,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // stats: try org-wide (admins) → fall back to "my" scope (agents)
  const { data: stats, isLoading: sLoad } = useQuery({
    queryKey: ["dash-stats"],
    queryFn: async () => {
      try {
        return (await api.get("/admin/stats/")).data;
      } catch (e) {
        if (e?.response?.status === 403 || e?.response?.status === 404) {
          return (await api.get("/my/stats/")).data;
        }
        throw e;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  // recent tickets (server scopes by org + viewer visibility)
  const { data: recent, isLoading: rLoad } = useQuery({
    queryKey: ["dash-recent"],
    queryFn: async () =>
      (await api.get("/tickets/?ordering=-created_at&page_size=6")).data,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const total = stats?.total_tickets ?? 0;
  const openCount =
    (stats?.by_status?.OPEN ?? 0) +
    (stats?.by_status?.PENDING ?? 0) +
    (stats?.by_status?.IN_PROGRESS ?? 0);
  const resolvedCount =
    (stats?.by_status?.RESOLVED ?? 0) +
    (stats?.by_status?.CLOSED ?? 0) +
    (stats?.by_status?.DONE ?? 0);
  const resolvedPct = total ? Math.round((resolvedCount / total) * 100) : 0;
  const urgent = stats?.by_priority?.URGENT ?? 0;

  const rows = (recent?.results ?? recent ?? []).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top row: welcome + actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card card-p">
          <h2 className="page-title">
            Welcome{me?.first_name ? `, ${me.first_name}` : ""}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {stats?.scope === "org" ? "Organization" : "My"} workspace — create
            tickets, assign, and track progress.
          </p>
        </section>

        <section className="card card-p">
          <h2 className="page-title">Quick Actions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/tickets/new" className="btn btn-primary">
              New Ticket
            </Link>
            <Link to="/tickets" className="btn">
              View Tickets
            </Link>
            {(me?.role === "ADMIN" || me?.role === "SUPERVISOR") && (
              <a
                className="btn"
                href="http://127.0.0.1:8000/admin/"
                target="_blank"
                rel="noreferrer"
              >
                Admin
              </a>
            )}
          </div>
        </section>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI title="Total tickets" value={sLoad ? "…" : total} sub="All time" />
        <KPI
          title="Open"
          value={sLoad ? "…" : openCount}
          sub="Open / Pending / In progress"
        />
        <KPI
          title="Resolved %"
          value={sLoad ? "…" : `${resolvedPct}%`}
          sub={`${resolvedCount} resolved`}
        />
        <KPI
          title="Urgent"
          value={sLoad ? "…" : urgent}
          sub="Current urgent tickets"
        />
      </div>

      {/* Recent tickets */}
      <section className="card card-p">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Recent tickets
            </h3>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {stats?.scope === "org"
                ? "Organization activity"
                : "Your recent activity"}
            </div>
          </div>
          <Link className="btn" to="/tickets">
            See all
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400">
                <th className="px-2 py-1">Subject</th>
                <th className="px-2 py-1">Group</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Assignee</th>
                <th className="px-2 py-1">Created</th>
              </tr>
            </thead>
            <tbody>
              {rLoad && (
                <tr>
                  <td className="px-2 py-3" colSpan={5}>
                    Loading…
                  </td>
                </tr>
              )}
              {!rLoad && rows.length === 0 && (
                <tr>
                  <td
                    className="px-2 py-6 text-slate-500 dark:text-slate-400"
                    colSpan={5}
                  >
                    No tickets yet.{" "}
                    <Link className="underline" to="/tickets/new">
                      Create your first ticket
                    </Link>
                    .
                  </td>
                </tr>
              )}
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                >
                  <td className="px-2 py-2">
                    <Link className="underline" to={`/tickets/${t.id}`}>
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{t.group_name || "—"}</td>
                  <td className="px-2 py-2">
                    <StatusBadge value={t.status} />
                  </td>
                  <td className="px-2 py-2">{t.assignee_name || "Unassigned"}</td>
                  <td className="px-2 py-2">
                    {t.created_at
                      ? new Date(t.created_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ---------- small UI helpers ---------- */

function KPI({ title, value, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm text-slate-500 dark:text-slate-400">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</div>
    </div>
  );
}

function StatusBadge({ value }) {
  const v = (value || "").toUpperCase();
  const map = {
    OPEN: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    IN_PROGRESS:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
    RESOLVED:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    CLOSED:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  };
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
        map[v] ||
        "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
      }`}
    >
      {v.replace("_", " ")}
    </span>
  );
}
