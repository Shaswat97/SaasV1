"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";

type Theme = "light" | "dark";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("theme");
  return stored === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initial = getStoredTheme();
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const nextTheme: Theme = theme === "light" ? "dark" : "light";

  return (
    <div className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Theme</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-sm text-text">{theme === "light" ? "Light" : "Dark"}</span>
        <Button variant="ghost" onClick={() => setTheme(nextTheme)}>
          Switch to {nextTheme}
        </Button>
      </div>
    </div>
  );
}
