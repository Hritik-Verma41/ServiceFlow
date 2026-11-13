import { AuthGuard } from "./components/auth-guard";
import { DashboardStats } from "./components/dashboard-stats";
import Image from "next/image";
import { JobStatusBreakdown } from "./components/job-status-breakdown";
import { LogoutButton } from "./components/logout-button";
import { MobileNavigation } from "./components/mobile-navigation";
import { RecentServiceJobs } from "./components/recent-service-jobs";
import { ThemeToggle } from "./components/theme-toggle";

const navigation = [
  { icon: "⌂", label: "Overview" },
  { icon: "▤", label: "Service Jobs" },
  { icon: "♙", label: "Customers" },
  { icon: "⚙", label: "Technicians" },
  { icon: "▦", label: "Inventory" },
  { icon: "₹", label: "Invoices" },
];

export default function Home() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">

        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col bg-slate-950 text-white md:flex">
          <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1">
              <Image
                src="/serviceflow-icon.png"
                alt="ServiceFlow"
                width={44}
                height={44}
                priority
                className="h-full w-full object-contain"
              />
            </div>

            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Service<span className="text-blue-400">Flow</span>
              </h1>
              <p className="text-xs text-slate-400">
                Field Service Management
              </p>
            </div>
          </div>

          <div className="px-4 py-7">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Workspace
            </p>

            <nav className="space-y-1">
              {navigation.map((item, index) => (
                <a
                  key={item.label}
                  href="#"
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${index === 0
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

          <div className="mt-auto border-t border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 font-semibold">
                HV
              </div>
              <div>
                <p className="text-sm font-medium">Admin User</p>
                <p className="text-xs text-slate-400">Company Admin</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1">

          {/* Header */}
          <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-slate-900 sm:px-8">
            <div className="flex items-center gap-3">
              <MobileNavigation />

              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Workspace / Overview
                </p>
                <h2 className="text-xl font-semibold tracking-tight">
                  Dashboard
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:block">
                ⌕ Search
              </button>

              <button
                aria-label="Notifications"
                className="relative rounded-lg border border-slate-200 px-3 py-2 text-lg transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                ♧
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600" />
              </button>
              <LogoutButton />
              <ThemeToggle />
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-8 p-5 sm:p-8">

            {/* Welcome Section */}
            <section className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight">
                  Good morning, Admin 👋
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Here&apos;s what&apos;s happening with your operations today.
                </p>
              </div>

              <button className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700">
                + Create Service Job
              </button>
            </section>

            {/* Dashboard Statistics */}
            <DashboardStats />

            {/* Job Status Breakdown */}
            <JobStatusBreakdown />

            {/* Recent Service Jobs */}
            <RecentServiceJobs />
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
