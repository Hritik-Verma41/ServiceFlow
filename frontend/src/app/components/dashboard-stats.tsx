"use client";

import { useEffect, useState } from "react";
import type { DashboardDateRange } from "./date-range-selector";

interface DashboardStatsProps {
    dateRange: DashboardDateRange;
}

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

interface RevenueResponse {
    collected_revenue: string;
    currency: string;
}

export function DashboardStats({ dateRange }: DashboardStatsProps) {
    const [totalJobs, setTotalJobs] = useState<number | null>(null);
    const [activeJobs, setActiveJobs] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [technicians, setTechnicians] = useState<number | null>(null);
    const [revenue, setRevenue] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        async function fetchStats() {
            try {
                setError("");

                if (!dateRange.startDate || !dateRange.endDate) {
                    setTotalJobs(null);
                    setActiveJobs(null);
                    setRevenue(null);
                    return;
                }

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
                    {
                        headers,
                        signal: controller.signal,
                    }
                );

                if (!companyResponse.ok) {
                    throw new Error("Unable to load company information.");
                }

                const companies: Company[] = await companyResponse.json();

                if (companies.length === 0) {
                    throw new Error("No active company found.");
                }

                const companyId = companies[0].id;

                const queryParams = new URLSearchParams({
                    start_date: dateRange.startDate,
                    end_date: dateRange.endDate,
                });

                // Fetch current technician count.
                const membersResponse = await fetch(
                    `${apiUrl}/api/companies/${companyId}/members/`,
                    {
                        headers,
                        signal: controller.signal,
                    }
                );

                if (!membersResponse.ok) {
                    throw new Error("Unable to load technician information.");
                }

                const members: CompanyMember[] =
                    await membersResponse.json();

                setTechnicians(
                    members.filter(
                        (member) =>
                            member.role === "TECHNICIAN" &&
                            member.status === "ACTIVE"
                    ).length
                );

                // Fetch jobs created during the selected period.
                const jobsResponse = await fetch(
                    `${apiUrl}/api/companies/${companyId}/jobs/?${queryParams}`,
                    {
                        headers,
                        signal: controller.signal,
                    }
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

                // Fetch collected revenue during the selected period.
                const revenueResponse = await fetch(
                    `${apiUrl}/api/companies/${companyId}/revenue/?${queryParams}`,
                    {
                        headers,
                        signal: controller.signal,
                    }
                );

                if (!revenueResponse.ok) {
                    throw new Error("Unable to load revenue information.");
                }

                const revenueData: RevenueResponse =
                    await revenueResponse.json();

                setRevenue(
                    new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: revenueData.currency,
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }).format(Number(revenueData.collected_revenue))
                );
            } catch (err) {
                if (
                    err instanceof Error &&
                    err.name === "AbortError"
                ) {
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load dashboard statistics."
                );
            }
        }

        fetchStats();

        return () => controller.abort();
    }, [dateRange.startDate, dateRange.endDate]);

    const stats = [
        { label: "Total Jobs", value: totalJobs, icon: "▤" },
        { label: "Active Jobs", value: activeJobs, icon: "◷" },
        { label: "Technicians", value: technicians, icon: "♙" },
        { label: "Revenue", value: revenue, icon: "₹" },
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
                                ? "Loading..."
                                : stat.value}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                            {stat.label === "Technicians"
                                ? "Current active team"
                                : "Selected date range"}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}
