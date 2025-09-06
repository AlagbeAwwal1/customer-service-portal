import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import { Link } from "react-router-dom";

const statusOrder = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const priorityOrder = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function SortIcon({ dir }) {
  return <span className="text-xs">{dir === "asc" ? "▲" : "▼"}</span>;
}

export default function TicketsList() {
  const { data } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => (await api.get("/tickets/")).data,
  });

  const [sortBy, setSortBy] = useState("subject");
  const [sortDir, setSortDir] = useState("asc");

  const setSort = (key) => {
    if (key === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const rows = useMemo(() => {
    const arr = [...(data ?? [])];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av, bv;
      switch (sortBy) {
        case "customer_name":
          av = a.customer_name || "";
          bv = b.customer_name || "";
          break;
        case "status":
          av = statusOrder.indexOf(a.status);
          bv = statusOrder.indexOf(b.status);
          break;
        case "priority":
          av = priorityOrder.indexOf(a.priority);
          bv = priorityOrder.indexOf(b.priority);
          break;
        default:
          av = a.subject || "";
          bv = b.subject || "";
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [data, sortBy, sortDir]);

  const Th = ({ id, children, className = "" }) => (
    <th className={`py-2 px-4 font-semibold ${className}`}>
      <button onClick={() => setSort(id)} className="flex items-center gap-1">
        <span>{children}</span>
        {sortBy === id ? (
          <SortIcon dir={sortDir} />
        ) : (
          <span className="text-slate-400">↕</span>
        )}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="page-title">Tickets</h2>
        <Link to="/tickets/new" className="btn btn-primary">
          + New Ticket
        </Link>
      </div>

      <div className="card">
        {/* Sticky header needs a scroll container */}
        <div className="card-p max-h-[70vh] overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
              <tr className="text-slate-500 dark:text-slate-400">
                <Th id="subject" className="pr-4">
                  Subject
                </Th>
                <Th id="customer_name">Customer</Th>
                <Th id="status">Status</Th>
                <Th id="priority">Priority</Th>
                <Th id="assignee">Assigned to</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <td className="py-3 pr-4">
                    <Link
                      to={`/tickets/${t.id}`}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{t.customer_name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">
                      {t.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">{t.priority}</td>
                  <td className="px-4 py-3">
                    {t.assignee_name || "Unassigned"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="py-6 text-slate-500" colSpan={4}>
                    No tickets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
