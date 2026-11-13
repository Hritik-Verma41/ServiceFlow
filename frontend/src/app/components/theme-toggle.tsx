"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const options = [
        { value: "system", label: "System", icon: "▣" },
        { value: "light", label: "Light", icon: "☀" },
        { value: "dark", label: "Dark", icon: "☾" },
    ] as const;

    const selected = options.find((option) => option.value === theme);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-label="Change appearance"
                aria-expanded={open}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
                {selected?.icon ?? "◐"}
            </button>

            {open && (
                <>
                    <button
                        type="button"
                        aria-label="Close appearance menu"
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setOpen(false)}
                    />

                    <div className="absolute right-0 top-full z-50 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Appearance
                        </p>

                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    setTheme(option.value);
                                    setOpen(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${theme === option.value
                                        ? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                    }`}
                            >
                                <span className="flex items-center gap-3">
                                    <span>{option.icon}</span>
                                    {option.label}
                                </span>

                                {theme === option.value && <span>✓</span>}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
