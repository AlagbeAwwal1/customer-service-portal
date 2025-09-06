// src/pages/TicketDetail.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";

export default function TicketDetail() {
  const { id } = useParams();
  const qc = useQueryClient();

  // --- Fetch ticket + current user ---
  const {
    data: ticket,
    isLoading: tLoading,
    error: tErr,
  } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => (await api.get(`/tickets/${id}/`)).data,
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/me/")).data,
  });

  // --- Permissions & state helpers ---
  const canAssign =
    me &&
    ticket &&
    (me.role === "ADMIN" ||
      me.role === "SUPERVISOR" ||
      me.id === ticket.group_manager_id);

  const isAssignee = me && ticket && me.id === ticket.assignee;

  const CLOSED_STATES = ["RESOLVED", "CLOSED", "DONE"];
  const isClosed = CLOSED_STATES.includes((ticket?.status || "").toUpperCase());

  // --- Load group members for assignment ---
  const { data: members, isLoading: mLoading } = useQuery({
    enabled: !!ticket?.group,
    queryKey: ["group-members", ticket?.group],
    queryFn: async () => (await api.get(`/groups/${ticket.group}/members/`)).data,
  });

  // --- Controlled select for assignee (prevents {assignee: null}) ---
  const [assigneeId, setAssigneeId] = useState("");
  useEffect(() => {
    setAssigneeId(ticket?.assignee ? String(ticket.assignee) : "");
  }, [ticket?.assignee]);

  // --- Resolution comment for closing ---
  const [resolution, setResolution] = useState("");

  // --- Mutations ---
  const assignMutation = useMutation({
    mutationFn: async () =>
      (await api.post(`/tickets/${id}/assign/`, { assignee: Number(assigneeId) })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () =>
      (await api.post(`/tickets/${id}/close/`, { comment: resolution })).data,
    onSuccess: () => {
      setResolution("");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    },
  });

  // --- Render guards ---
  if (tLoading) return <div>Loading…</div>;
  if (tErr) return <div className="text-rose-600">Could not load ticket.</div>;
  if (!ticket) return null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* LEFT: ticket content */}
      <section className="card card-p md:col-span-2">
        <h2 className="page-title">{ticket.subject}</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
          {ticket.description || "No description"}
        </p>

        <h3 className="mt-5 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Comments
        </h3>
        <ul className="mt-2 space-y-2">
          {ticket.comments?.length ? (
            ticket.comments.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <span className="font-medium">{c.author_name}</span>: {c.body}
              </li>
            ))
          ) : (
            <li className="text-sm text-slate-500 dark:text-slate-400">No comments.</li>
          )}
        </ul>
      </section>

      {/* RIGHT: meta, assign, close */}
      <aside className="card card-p space-y-3">
        <div>
          <span className="label">Group</span>
          <div className="text-sm">{ticket.group_name}</div>
        </div>

        <div>
          <span className="label">Manager</span>
          <div className="text-sm">{ticket.group_manager_name || "—"}</div>
        </div>

        <div>
          <span className="label">Status</span>
          <div className="inline-block rounded-lg bg-slate-100 px-2 py-1 text-sm font-semibold dark:bg-slate-800">
            {ticket.status?.replace("_", " ")}
          </div>
        </div>

        <div>
          <span className="label">Priority</span>
          <div className="text-sm">{ticket.priority}</div>
        </div>

        <div>
          <span className="label">Customer</span>
          <div className="text-sm">{ticket.customer_name}</div>
        </div>

        <div>
          <span className="label">Assigned to</span>
          <div className="text-sm">{ticket.assignee_name || "Unassigned"}</div>
        </div>

        {/* Assign UI: visible to group manager or admin/supervisor */}
        {canAssign && (
          <div className="pt-2">
            <span className="label">Assign to member</span>
            <div className="flex gap-2">
              <select
                className="select"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="" disabled>
                  {mLoading ? "Loading members…" : "Select a member"}
                </option>
                {(members ?? []).map((m) => (
                  <option key={m.id ?? m.user_id} value={String(m.id ?? m.user_id)}>
                    {m.name || m.username}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                disabled={!assigneeId || assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                {assignMutation.isPending ? "Assigning…" : "Assign"}
              </button>
            </div>
            {assignMutation.isError && (
              <div className="mt-2 text-sm text-rose-600">
                {assignMutation.error?.response?.data?.detail ||
                  (assignMutation.error?.response?.status === 404
                    ? "Assign endpoint not found. Check /api/tickets/:id/assign/."
                    : "Could not assign.")}
              </div>
            )}
          </div>
        )}

        {/* Close Ticket: only the assignee can close, and only if not already closed */}
        {isAssignee && !isClosed && (
          <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-2 text-sm font-semibold">Close ticket with a comment</div>
            <textarea
              className="textarea"
              placeholder="Describe the fix / outcome so the requester understands."
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                className="btn btn-primary"
                disabled={!resolution.trim() || closeMutation.isPending}
                onClick={() => closeMutation.mutate()}
              >
                {closeMutation.isPending ? "Closing…" : "Close Ticket"}
              </button>
              {closeMutation.isError && (
                <span className="text-sm text-rose-600">
                  {closeMutation.error?.response?.data?.detail || "Could not close ticket."}
                </span>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
