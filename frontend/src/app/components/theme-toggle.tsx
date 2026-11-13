"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, systemTheme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    console.log("ThemeToggle mounted");
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={() =>
        setTheme(
          theme === "system"
            ? "light"
            : theme === "light"
              ? "dark"
              : "system"
        )
      }
      className="rounded-lg border border-slate-400 p-3 text-slate-900 dark:text-white"
    >
      Theme: {theme} | Resolved: {resolvedTheme}
    </button>
  );
}