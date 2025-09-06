import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./app";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TicketsList from "./pages/TicketsList";
import TicketDetail from "./pages/TicketDetail";
import TicketForm from "./pages/TicketForm";
import AdminDashboard from "./pages/AdminDashboard";
import Signup from "./pages/Signup";

const Protected = ({ children }) => {
  const authed = !!localStorage.getItem("access");
  return authed ? children : <Navigate to="/login" replace />;
};

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: '/signup', element: <Signup/> },
  {
    path: "/",
    element: <Protected><App /></Protected>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "tickets", element: <TicketsList /> },
      { path: "tickets/new", element: <TicketForm /> },
      { path: "tickets/:id", element: <TicketDetail /> },
      { path: "admin", element: <AdminDashboard /> },
    ],
  },
]);
