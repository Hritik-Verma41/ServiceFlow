"use client";

import { useEffect, useState } from "react";

interface Company {
    id: string;
}

interface ServiceJob {
    status: string;
}

interface CompanyMember {
    role: string;
    status: string;
}

export function DashboardStats() {
    const [totalJobs, setTotalJobs] = useState<number | null>(null);
    const [activeJobs, setActiveJobs] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [technicians, setTechnicians] = useState<number | null>(null);

    useEffect(() => {
        async function fetchStats() {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
                const token = sessionStorage.getItem("accessToken");

                if (!apiUrl || !token) {
                    throw new Error("API configuration or session is missing.");
                }

                const headers = {
                    Authorization: `Bearer ${token}`,
                };

                const companyResponse = await fetch(
                    `${apiUrl}/api/companies/`,
                    { headers }
                );

                if (!companyResponse.ok) {
                    throw new Error("Unable to load company information.");
                }

                const companies: Company[] = await companyResponse.json();

                if (companies.length === 0) {
                    throw new Error("No active company found.");
                }

                const membersResponse = await fetch(
                    `${apiUrl}/api/companies/${companies[0].id}/members/`,
                    { headers }
                );

                if (!membersResponse.ok) {
                    throw new Error("Unable to load technician information.");
                }

                const members: CompanyMember[] = await membersResponse.json();

                setTechnicians(
                    members.filter(
                        (member) =>
                            member.role === "TECHNICIAN" &&
                            member.status === "ACTIVE"
                    ).length
                );

                const jobsResponse = await fetch(
                    `${apiUrl}/api/companies/${companies[0].id}/jobs/`,
                    { headers }
                );

                if (!jobsResponse.ok) {
                    throw new Error("Unable to load job statistics.");
                }

                const jobs: ServiceJob[] = await jobsResponse.json();

                setTotalJobs(jobs.length);

                setActiveJobs(
                    jobs.filter(
                        (job) =>
                            job.status !== "COMPLETED" &&
                            job.status !== "CANCELLED"
                    ).length
                );
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load dashboard statistics."
                );
            }
        }

        fetchStats();
    }, []);

    const stats = [
        { label: "Total Jobs", value: totalJobs, icon: "▤" },
        { label: "Active Jobs", value: activeJobs, icon: "◷" },
        { label: "Technicians", value: technicians, icon: "♙" },
        { label: "Revenue", value: null, icon: "₹" },
    ];

    return (
        <section className="space-y-3">
            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                            {stat.value === null
                                ? stat.label === "Revenue"
                                    ? "—"
                                    : "Loading..."
                                : stat.value}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                            {stat.label !== "Revenue"
                                ? "Live data"
                                : "Not connected yet"}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}
