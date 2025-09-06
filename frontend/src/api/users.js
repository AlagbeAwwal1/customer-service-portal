import api from "./axios";

/** Return the signed-in user (role + organization) */
export async function me() {
  const { data } = await api.get("/me/");
  return data;
}

/** Public signup: creates an AGENT user and returns tokens */
export async function signup({ username, email, password }) {
  const { data } = await api.post("/signup/", { username, email, password });
  if (data?.access && data?.refresh) {
    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
  }
  return data;
}
