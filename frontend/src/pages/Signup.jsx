import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

export default function SignUp() {
  const nav = useNavigate();
  const [mode, setMode] = useState("create"); // "create" | "join"
  const [form, setForm] = useState({
    username: "", email: "", password: "",
    first_name: "", last_name: "",
    organization_name: "", organization_code: "", role: "AGENT",
  });
  const [err, setErr] = useState("");

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const payload = {
        username: form.username,
        password: form.password,
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
      };
      if (mode === "create") payload.organization_name = form.organization_name;
      else {
        payload.organization_code = form.organization_code;
        payload.role = form.role || "AGENT";
      }
      const { data } = await api.post("/register/", payload);
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      nav("/");
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Could not sign up.");
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="page-title">Create your account</h1>
      <div className="mt-2 flex gap-3 text-sm">
        <button
          className={`btn btn-sm ${mode==="create"?"btn-primary":""}`}
          onClick={() => setMode("create")}
        >Create new organization</button>
        <button
          className={`btn btn-sm ${mode==="join"?"btn-primary":""}`}
          onClick={() => setMode("join")}
        >Join existing organization</button>
      </div>

      <form className="mt-4 space-y-3" onSubmit={submit}>
        <input className="input" name="username" placeholder="Username" value={form.username} onChange={onChange} required />
        <input className="input" name="email" type="email" placeholder="Email" value={form.email} onChange={onChange} />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" name="first_name" placeholder="First name" value={form.first_name} onChange={onChange} />
          <input className="input" name="last_name" placeholder="Last name" value={form.last_name} onChange={onChange} />
        </div>
        <input className="input" name="password" type="password" placeholder="Password" value={form.password} onChange={onChange} required />

        {mode === "create" ? (
          <input className="input" name="organization_name" placeholder="Organization name" value={form.organization_name} onChange={onChange} required />
        ) : (
          <>
            <input className="input" name="organization_code" placeholder="Organization invite code" value={form.organization_code} onChange={onChange} required />
            <label className="text-xs text-slate-500 dark:text-slate-400">Role when joining</label>
            <select className="select" name="role" value={form.role} onChange={onChange}>
              <option value="AGENT">Agent</option>
              <option value="SUPERVISOR">Supervisor</option>
            </select>
          </>
        )}

        {err && <div className="text-sm text-rose-600">{String(err)}</div>}

        <button className="btn btn-primary w-full" type="submit">Sign up</button>
      </form>

      <div className="mt-4 text-center text-sm">
        Already have an account? <Link className="underline" to="/login">Log in</Link>
      </div>
    </div>
  );
}
