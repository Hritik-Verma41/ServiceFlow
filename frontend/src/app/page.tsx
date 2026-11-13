import { AuthGuard } from "./components/auth-guard";
import Image from "next/image";
import { ThemeToggle } from "./components/theme-toggle";

const stats = [
  { label: "Total Jobs", value: "248", change: "+12.5%", icon: "▤" },
  { label: "Active Jobs", value: "42", change: "+8.2%", icon: "◷" },
  { label: "Technicians", value: "18", change: "+2 this month", icon: "♙" },
  { label: "Revenue", value: "₹4,82,500", change: "+15.3%", icon: "₹" },
];

const jobs = [
  { id: "JOB-1024", customer: "Acme Industries", service: "AC Maintenance", technician: "Rahul Sharma", date: "13 Nov 2026", status: "In Progress" },
  { id: "JOB-1023", customer: "Bright Solutions", service: "Electrical Repair", technician: "Amit Kumar", date: "13 Nov 2026", status: "Scheduled" },
  { id: "JOB-1022", customer: "Nova Healthcare", service: "Equipment Inspection", technician: "Priya Singh", date: "12 Nov 2026", status: "Completed" },
  { id: "JOB-1021", customer: "Urban Spaces", service: "Plumbing Repair", technician: "Vikash Gupta", date: "12 Nov 2026", status: "Completed" },
];

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
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Workspace / Overview
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                Dashboard
              </h2>
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

            {/* Statistics */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {stat.label}
                    </p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-lg text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      {stat.icon}
                    </span>
                  </div>

                  <p className="mt-4 text-2xl font-semibold tracking-tight">
                    {stat.value}
                  </p>

                  <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {stat.change}
                  </p>
                </div>
              ))}
            </section>

            {/* Recent Service Jobs */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-5 dark:border-slate-800">
                <div>
                  <h3 className="font-semibold">
                    Recent Service Jobs
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    A snapshot of your latest service activity.
                  </p>
                </div>

                <button className="text-sm font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                  View all jobs →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-4 font-medium">Job ID</th>
                      <th className="px-5 py-4 font-medium">Customer</th>
                      <th className="px-5 py-4 font-medium">Service</th>
                      <th className="px-5 py-4 font-medium">Technician</th>
                      <th className="px-5 py-4 font-medium">Date</th>
                      <th className="px-5 py-4 font-medium">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {jobs.map((job) => (
                      <tr
                        key={job.id}
                        className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="whitespace-nowrap px-5 py-4 font-medium text-blue-600 dark:text-blue-400">
                          {job.id}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-medium">
                          {job.customer}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                          {job.service}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                          {job.technician}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                          {job.date}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${job.status === "Completed"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : job.status === "In Progress"
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              }`}
                          >
                            {job.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
