import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useQuery } from "@tanstack/react-query";

export default function TicketForm() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    group: "", customer_name:"", subject:"", description:"", priority:"MEDIUM"
  });

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => (await api.get("/groups/")).data,
  });

  async function submit(e){
    e.preventDefault();
    await api.post("/tickets/", form);
    nav("/tickets");
  }

  return (
    <div className="card">
      <form onSubmit={submit} className="card-p grid gap-4">
        <h2 className="page-title">New Ticket</h2>

        <div>
          <label className="label">Group</label>
          <select className="select" required
            value={form.group}
            onChange={(e)=>setForm(f=>({...f, group:e.target.value}))}>
            <option value="" disabled>Select a group</option>
            {(groups ?? []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Customer Name</label>
          <input className="input" value={form.customer_name}
            onChange={(e)=>setForm(f=>({...f,customer_name:e.target.value}))}/>
        </div>

        <div>
          <label className="label">Subject</label>
          <input className="input" value={form.subject}
            onChange={(e)=>setForm(f=>({...f,subject:e.target.value}))}/>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="textarea" value={form.description}
            onChange={(e)=>setForm(f=>({...f,description:e.target.value}))}/>
        </div>

        <div>
          <label className="label">Priority</label>
          <select className="select" value={form.priority}
            onChange={(e)=>setForm(f=>({...f,priority:e.target.value}))}>
            <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" type="submit">Create</button>
          <button className="btn" type="button" onClick={()=>nav(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
