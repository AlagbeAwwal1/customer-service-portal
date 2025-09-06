import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { me } from "./api/users";
import { logout } from "./api/auth";
import ThemeToggle from "./components/ThemeToggle";   // ⬅️ add this
import "./index.css";

export default function App() {
  const nav = useNavigate();
  const { data: user } = useQuery({ queryKey:["me"], queryFn: me });
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERVISOR";

  function doLogout() { logout(); nav("/login"); }

  const linkBase = "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium";
  const linkActive = "bg-indigo-600 text-white";
  const linkIdle = "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="container-narrow flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-18 w-10 overflow-hidden rounded-full bg-white">
              <img src="./assets/logo.jpg" alt="" />
            </div>
            <span className="text-base font-semibold">Customer Service Portal</span>
          </div>
          <nav className="hidden gap-2 sm:flex">
            <NavLink to="/" end className={({isActive}) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>Dashboard</NavLink>
            <NavLink to="/tickets" className={({isActive}) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>Tickets</NavLink>
            {isAdmin && <NavLink to="/admin" className={({isActive}) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>Admin</NavLink>}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />   {/* ⬅️ dark-mode toggle */}
            <div className="hidden text-sm text-slate-600 dark:text-slate-300 sm:block">
              {user?.organization?.name ? `${user.organization.name} • ` : ""}{user?.username}
            </div>
            <button onClick={doLogout} className="btn">Logout</button>
          </div>
        </div>
      </header>
      <main className="container-narrow py-6">
        <Outlet />
      </main>
    </div>
  );
}
