import { useState } from "react";
import { login } from "../api/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      await login(form.username, form.password);
      nav("/");
    } catch (e) {
      console.error(e?.response?.data || e.message);
      setErr(e?.response?.data?.detail || "Invalid credentials");
    }
  };

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center">
      <div className="card w-full">
        <form onSubmit={submit} className="card-p space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="text-sm text-slate-600">
              Use your username and password
            </p>
          </div>

          <div>
            <label className="label">Username</label>
            <input
              className="input"
              placeholder="admin"
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
            />
          </div>

          {err && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {err}
            </div>
          )}
          <div className="text-center text-sm text-slate-600 dark:text-slate-400">
            No account?{" "}
            <a href="/signup" className="text-indigo-600 hover:underline">
              Sign up
            </a>
          </div>

          <button className="btn btn-primary w-full">Login</button>
        </form>
      </div>
    </div>
  );
}
