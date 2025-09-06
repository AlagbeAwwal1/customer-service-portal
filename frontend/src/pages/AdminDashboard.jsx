// src/pages/AdminDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import {
  BarChart as RBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

/* ---------- shared bits ---------- */

function StatCard({ label, value }) {
  return (
    <div className="card card-p">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function AnimatedBarChart({ data }) {
  return (
    <div className="card card-p">
      <div className="page-title mb-2">Tickets Created (Last 7 Days)</div>
      <div className="h-64 text-slate-700 dark:text-slate-300">
        <ResponsiveContainer width="100%" height="100%">
          <RBarChart data={data}>
            <CartesianGrid stroke="currentColor" opacity={0.1} />
            <XAxis dataKey={(d) => d.date.slice(5)} tick={{ fill: "currentColor" }} axisLine={{ stroke: "currentColor" }} tickLine={{ stroke: "currentColor" }} />
            <YAxis allowDecimals={false} tick={{ fill: "currentColor" }} axisLine={{ stroke: "currentColor" }} tickLine={{ stroke: "currentColor" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "rgb(15 23 42 / 0.95)", border: "1px solid rgb(51 65 85)", color: "#e2e8f0" }}
              wrapperStyle={{ outline: "none" }}
              labelFormatter={(v) => `Day: ${v}`}
            />
            <Bar dataKey="count" fill="currentColor" isAnimationActive animationDuration={800} radius={[8, 8, 0, 0]} />
          </RBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function AdminDashboard() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/me/")).data,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const isOrgAdmin = me?.role === "ADMIN" || me?.role === "SUPERVISOR";
  const [tab, setTab] = useState("overview"); // overview | users | groups

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="page-title">Admin Dashboard</h2>
        <div className="flex flex-wrap gap-2">
          <button className={`btn btn-sm ${tab === "overview" ? "btn-primary" : ""}`} onClick={() => setTab("overview")}>Overview</button>
          <button className={`btn btn-sm ${tab === "users" ? "btn-primary" : ""}`} onClick={() => setTab("users")} disabled={!isOrgAdmin} title={!isOrgAdmin ? "Org admin only" : ""}>Users</button>
          <button className={`btn btn-sm ${tab === "groups" ? "btn-primary" : ""}`} onClick={() => setTab("groups")} disabled={!isOrgAdmin} title={!isOrgAdmin ? "Org admin only" : ""}>Groups</button>
        </div>
      </div>

      {tab === "overview" && <OverviewTab />}
      {isOrgAdmin && tab === "users" && <UsersTab />}
      {isOrgAdmin && tab === "groups" && <GroupsTab />}
      {!isOrgAdmin && tab !== "overview" && (
        <div className="card card-p text-rose-600">You need ADMIN or SUPERVISOR role to manage your organization.</div>
      )}
    </div>
  );
}

/* ---------- Overview (unchanged + resilient) ---------- */

function OverviewTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => (await api.get("/admin/stats/")).data,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  if (isLoading) return <div>Loading…</div>;
  if (error) return <div className="text-rose-600">You don’t have permission to view org-wide stats.</div>;

  const s = data || {};
  const statusOrder = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  const priorityOrder = ["LOW", "MEDIUM", "HIGH", "URGENT"];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Tickets" value={s.total_tickets ?? 0} />
        {statusOrder.map(k => <StatCard key={k} label={k.replace("_"," ")} value={s.by_status?.[k] ?? 0} />)}
      </div>

      <AnimatedBarChart data={s.last_7_days || []} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card card-p">
          <div className="page-title mb-2">By Priority</div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {priorityOrder.map(k => (
              <li key={k} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{k}</div>
                <div className="text-lg font-semibold">{s.by_priority?.[k] ?? 0}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card card-p">
          <div className="page-title mb-2">Top Agents</div>
          <ul className="space-y-2">
            {(s.top_agents || []).map(row => (
              <li key={row.agent || "Unassigned"} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
                <span>{row.agent || "Unassigned"}</span><span className="font-semibold">{row.count}</span>
              </li>
            ))}
            {(!s.top_agents || s.top_agents.length === 0) && <li className="text-sm text-slate-500 dark:text-slate-400">No data yet.</li>}
          </ul>
        </div>
      </div>
    </>
  );
}

/* ---------- Users: edit role & active ---------- */

function UsersTab() {
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["org-users"],
    queryFn: async () => (await api.get("/org-admin/users/")).data,
    retry: false,
  });

  const updateUser = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/org-admin/users/${id}/`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-users"] }),
  });

  if (isLoading) return <div className="card card-p">Loading…</div>;

  return (
    <div className="card card-p">
      <div className="page-title mb-2">Users</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400">
              <th className="px-2 py-1">Username</th>
              <th className="px-2 py-1">Email</th>
              <th className="px-2 py-1">Role</th>
              <th className="px-2 py-1">Active</th>
              <th className="px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map(u => (
              <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-2 py-2">{u.username}</td>
                <td className="px-2 py-2">{u.email || "—"}</td>
                <td className="px-2 py-2">
                  <select
                    className="select"
                    value={u.role}
                    onChange={(e) => updateUser.mutate({ id: u.id, role: e.target.value })}
                  >
                    <option value="AGENT">Agent</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td className="px-2 py-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!u.is_active}
                      onChange={(e) => updateUser.mutate({ id: u.id, is_active: e.target.checked })}
                    />
                    <span>{u.is_active ? "Yes" : "No"}</span>
                  </label>
                </td>
                <td className="px-2 py-2">
                  <button
                    className="btn btn-sm"
                    onClick={() => updateUser.mutate({ id: u.id, role: "AGENT" })}
                    title="Quick demote to Agent"
                  >
                    Set Agent
                  </button>
                </td>
              </tr>
            ))}
            {users?.length === 0 && (
              <tr><td className="px-2 py-6 text-slate-500 dark:text-slate-400" colSpan={5}>No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Groups: manager + members ---------- */

function GroupsTab() {
  const qc = useQueryClient();

  const { data: groups } = useQuery({
    queryKey: ["org-groups"],
    queryFn: async () => (await api.get("/org-admin/groups/")).data,
    retry: false,
  });

  const { data: users } = useQuery({
    queryKey: ["org-users"],
    queryFn: async () => (await api.get("/org-admin/users/")).data,
    retry: false,
  });

  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!selected && groups?.length) setSelected(groups[0].id);
  }, [groups, selected]);

  const { data: members, refetch: refetchMembers, isFetching: loadingMembers } = useQuery({
    queryKey: ["org-group-members", selected],
    queryFn: async () => (selected ? (await api.get(`/org-admin/groups/${selected}/members/`)).data : []),
    enabled: !!selected,
    retry: false,
  });

  const changeManager = useMutation({
    mutationFn: ({ groupId, manager }) =>
      api.post(`/org-admin/groups/${groupId}/set-manager/`, { manager }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-groups"] }),
  });

  const addMember = useMutation({
    mutationFn: ({ groupId, userId }) =>
      api.post(`/org-admin/groups/${groupId}/members/${userId}/`).then(r => r.data),
    onSuccess: () => refetchMembers(),
  });

  const removeMember = useMutation({
    mutationFn: ({ groupId, userId }) =>
      api.delete(`/org-admin/groups/${groupId}/members/${userId}/`).then(r => r.data),
    onSuccess: () => refetchMembers(),
  });

  const selectedGroup = useMemo(() => (groups ?? []).find(g => g.id === selected), [groups, selected]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card card-p">
        <h3 className="text-base font-semibold">Groups</h3>
        <ul className="mt-2 space-y-1">
          {(groups ?? []).map(g => (
            <li key={g.id}>
              <button
                className={`w-full rounded-md px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selected === g.id ? "bg-slate-100 dark:bg-slate-800/60" : ""}`}
                onClick={() => setSelected(g.id)}
              >
                <div className="font-medium">{g.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Manager: {g.manager_name || "—"}
                </div>
              </button>
            </li>
          ))}
          {(groups ?? []).length === 0 && <li className="text-sm text-slate-500 dark:text-slate-400">No groups.</li>}
        </ul>
      </section>

      <section className="card card-p">
        <h3 className="text-base font-semibold">Group Settings</h3>

        {!selectedGroup ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Select a group.</div>
        ) : (
          <>
            <div className="mt-2">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Manager</div>
              <div className="mt-1 flex gap-2">
                <select
                  className="select"
                  value={selectedGroup.manager || ""}
                  onChange={(e) => changeManager.mutate({ groupId: selectedGroup.id, manager: Number(e.target.value) })}
                >
                  <option value="">— none —</option>
                  {(users ?? []).map(u => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                  ))}
                </select>
                {changeManager.isPending && <span className="text-xs">Saving…</span>}
              </div>
            </div>

            <div className="mt-4">
              <div className="page-title mb-2">Members</div>
              {loadingMembers ? (
                <div>Loading…</div>
              ) : (
                <ul className="space-y-1">
                  {(members ?? []).map(m => (
                    <li key={m.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
                      <span>{m.name || m.username} <span className="text-xs text-slate-500">({m.role})</span></span>
                      <button className="btn btn-sm" onClick={() => removeMember.mutate({ groupId: selectedGroup.id, userId: m.id })}>
                        Remove
                      </button>
                    </li>
                  ))}
                  {(members ?? []).length === 0 && <li className="text-sm text-slate-500 dark:text-slate-400">No members yet.</li>}
                </ul>
              )}

              <AddMember users={users ?? []} onAdd={(userId) => addMember.mutate({ groupId: selectedGroup.id, userId })} pending={addMember.isPending} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function AddMember({ users, onAdd, pending }) {
  const [uid, setUid] = useState("");
  return (
    <div className="mt-3 flex items-center gap-2">
      <select className="select" value={uid} onChange={(e) => setUid(e.target.value)}>
        <option value="">Select user to add…</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
      </select>
      <button className="btn btn-primary" disabled={!uid || pending} onClick={() => onAdd(Number(uid))}>
        {pending ? "Adding…" : "Add member"}
      </button>
    </div>
  );
}
/* ---------- old Dashboard (resilient) ---------- */

 