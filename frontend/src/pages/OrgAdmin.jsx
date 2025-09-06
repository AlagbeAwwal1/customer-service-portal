import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";

export default function OrgAdmin() {
  const [tab, setTab] = useState("users"); // "users" | "groups" | "members"
  return (
    <div className="space-y-4">
      <h1 className="page-title">Organization Admin</h1>
      <div className="flex gap-2">
        <button className={`btn btn-sm ${tab==="users"?"btn-primary":""}`} onClick={()=>setTab("users")}>Users</button>
        <button className={`btn btn-sm ${tab==="groups"?"btn-primary":""}`} onClick={()=>setTab("groups")}>Groups</button>
        <button className={`btn btn-sm ${tab==="members"?"btn-primary":""}`} onClick={()=>setTab("members")}>Memberships</button>
      </div>
      {tab==="users" && <UsersTab/>}
      {tab==="groups" && <GroupsTab/>}
      {tab==="members" && <MembersTab/>}
    </div>
  );
}

function UsersTab(){
  const qc = useQueryClient();
  const { data: users } = useQuery({ queryKey:["org-users"], queryFn: async()=> (await api.get("/org-admin/users/")).data });
  const create = useMutation({
    mutationFn: (body)=> api.post("/org-admin/users/", body).then(r=>r.data),
    onSuccess: ()=> qc.invalidateQueries({queryKey:["org-users"]}),
  });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card card-p">
        <h3 className="text-base font-semibold">Create user</h3>
        <UserForm onSubmit={(vals)=>create.mutate(vals)} submitting={create.isPending}/>
        {create.isError && <div className="text-rose-600 text-sm mt-2">Could not create.</div>}
      </section>

      <section className="card card-p">
        <h3 className="text-base font-semibold">Users</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="px-2 py-1">Username</th><th className="px-2 py-1">Email</th><th className="px-2 py-1">Role</th><th className="px-2 py-1">Active</th></tr></thead>
            <tbody>
              {(users ?? []).map(u=>(
                <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-2">{u.username}</td>
                  <td className="px-2 py-2">{u.email||"—"}</td>
                  <td className="px-2 py-2">{u.role}</td>
                  <td className="px-2 py-2">{u.is_active? "Yes":"No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function UserForm({ onSubmit, submitting }){
  const [f,setF]=useState({username:"",email:"",first_name:"",last_name:"",role:"AGENT",password:""});
  const change = e=> setF(s=>({...s,[e.target.name]:e.target.value}));
  return (
    <form className="space-y-2" onSubmit={(e)=>{e.preventDefault(); onSubmit(f);}}>
      <input className="input" name="username" placeholder="Username" value={f.username} onChange={change} required/>
      <input className="input" name="email" type="email" placeholder="Email" value={f.email} onChange={change}/>
      <div className="grid grid-cols-2 gap-2">
        <input className="input" name="first_name" placeholder="First name" value={f.first_name} onChange={change}/>
        <input className="input" name="last_name" placeholder="Last name" value={f.last_name} onChange={change}/>
      </div>
      <select className="select" name="role" value={f.role} onChange={change}>
        <option value="AGENT">Agent</option>
        <option value="SUPERVISOR">Supervisor</option>
        <option value="ADMIN">Admin</option>
      </select>
      <input className="input" name="password" type="password" placeholder="Temporary password" value={f.password} onChange={change}/>
      <button className="btn btn-primary" disabled={submitting}>{submitting?"Creating…":"Create user"}</button>
    </form>
  );
}

function GroupsTab(){
  const qc = useQueryClient();
  const { data: groups } = useQuery({ queryKey:["org-groups"], queryFn: async()=> (await api.get("/org-admin/groups/")).data });
  const create = useMutation({
    mutationFn: (body)=> api.post("/org-admin/groups/", body).then(r=>r.data),
    onSuccess: ()=> qc.invalidateQueries({queryKey:["org-groups"]}),
  });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card card-p">
        <h3 className="text-base font-semibold">Create group</h3>
        <GroupForm onSubmit={(vals)=>create.mutate(vals)} submitting={create.isPending}/>
      </section>
      <section className="card card-p">
        <h3 className="text-base font-semibold">Groups</h3>
        <ul className="list-disc pl-5">
          {(groups??[]).map(g=>(
            <li key={g.id}><b>{g.name}</b>{g.manager_name?` — manager: ${g.manager_name}`:""}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function GroupForm({ onSubmit, submitting }){
  const [f,setF]=useState({name:"", manager:null});
  const change = e=> setF(s=>({...s, [e.target.name]: e.target.value}));
  return (
    <form className="space-y-2" onSubmit={(e)=>{e.preventDefault(); onSubmit({...f, manager: f.manager||null});}}>
      <input className="input" name="name" placeholder="Group name" value={f.name} onChange={change} required/>
      <input className="input" name="manager" placeholder="Manager user id (optional)" value={f.manager||""} onChange={change}/>
      <button className="btn btn-primary" disabled={submitting}>{submitting?"Creating…":"Create group"}</button>
    </form>
  );
}

function MembersTab(){
  const qc = useQueryClient();
  const { data: groups } = useQuery({ queryKey:["org-groups"], queryFn: async()=> (await api.get("/org-admin/groups/")).data });
  const { data: users }  = useQuery({ queryKey:["org-users"],  queryFn: async()=> (await api.get("/org-admin/users/")).data });
  const add = useMutation({
    mutationFn: (body)=> api.post("/org-admin/memberships/", body).then(r=>r.data),
    onSuccess: ()=> qc.invalidateQueries({queryKey:["org-groups"]}),
  });
  const [g,setG]=useState(""); const [u,setU]=useState("");
  return (
    <section className="card card-p">
      <h3 className="text-base font-semibold">Add member to group</h3>
      <div className="mt-2 flex gap-2">
        <select className="select" value={g} onChange={(e)=>setG(e.target.value)}>
          <option value="">Select group</option>
          {(groups??[]).map(x=> <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select className="select" value={u} onChange={(e)=>setU(e.target.value)}>
          <option value="">Select user</option>
          {(users??[]).map(x=> <option key={x.id} value={x.id}>{x.username}</option>)}
        </select>
        <button className="btn btn-primary" disabled={!g||!u||add.isPending} onClick={()=>add.mutate({group:Number(g), user:Number(u)})}>
          {add.isPending? "Adding…":"Add"}
        </button>
      </div>
    </section>
  );
}
