"use client";

import Image from "next/image";
import { useState } from "react";
import { useCurrentUser } from "./current-user-provider";

const navigation = [
  { icon: "⌂", label: "Overview", href: "/" },
  { icon: "▤", label: "Service Jobs", href: "#" },
  { icon: "♙", label: "Customers", href: "#" },
  { icon: "⚙", label: "Team", href: "/team" },
  { icon: "▦", label: "Inventory", href: "#" },
  { icon: "₹", label: "Invoices", href: "#" },
];

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useCurrentUser();

  const displayName =
    user?.full_name?.trim() ||
    user?.email?.split("@")[0] ||
    "User";

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "U";

  const membership = user?.memberships?.[0];

  const displayRole = membership?.role
    ? membership.role
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Team Member";

  const profileSubtitle =
    membership?.company_name || displayRole;

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-xl text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        ☰
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/50"
          />

          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-slate-950 text-white shadow-2xl">
            {/* Logo */}
            <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1">
                  <Image
                    src="/serviceflow-icon.png"
                    alt="ServiceFlow"
                    width={40}
                    height={40}
                    className="h-full w-full object-contain"
                  />
                </div>

                <div>
                  <h2 className="text-lg font-semibold">
                    Service<span className="text-blue-400">Flow</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Field Service Management
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg px-3 py-2 text-xl text-slate-400 hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto px-4 py-7">
              <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Workspace
              </p>

              <nav className="space-y-1">
                {navigation.map((item, index) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${
                      index === 0
                        ? "bg-blue-600 font-medium text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="w-5 text-center text-lg">
                      {item.icon}
                    </span>
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>

            {/* Dynamic User Profile */}
            <div className="border-t border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 font-semibold">
                  {loading ? "..." : initials}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {loading ? "Loading..." : displayName}
                  </p>

                  <p className="truncate text-xs text-slate-400">
                    {loading ? " " : profileSubtitle}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
