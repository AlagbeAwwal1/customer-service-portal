import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const enableDark = saved ? saved === "dark" : prefers;
    setDark(enableDark);
    document.documentElement.classList.toggle("dark", enableDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button onClick={toggle} className="btn" title="Toggle theme">
      <span className="text-lg">{dark ? "🌙" : "☀️"}</span>
    </button>
  );
}
