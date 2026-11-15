"use client";

import { useEffect, useState } from "react";
import type { DashboardDateRange } from "./date-range-selector";
import { useCurrentUser } from "./current-user-provider";

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

interface DashboardStatsProps {
    dateRange: DashboardDateRange;
}

export function DashboardStats({ dateRange }: DashboardStatsProps) {
    const { user, loading: profileLoading } = useCurrentUser();

    const [totalJobs, setTotalJobs] = useState<number | null>(null);
    const [activeJobs, setActiveJobs] = useState<number | null>(null);
    const [technicians, setTechnicians] = useState<number | null>(null);
    const [revenue, setRevenue] = useState<string | null>(null);

    const [newJobs, setNewJobs] = useState<number | null>(null);
    const [scheduledJobs, setScheduledJobs] = useState<number | null>(null);
    const [inProgressJobs, setInProgressJobs] = useState<number | null>(null);

    const [error, setError] = useState("");

    const membership = user?.memberships?.[0];
    const companyId = membership?.company_id;
    const role = membership?.role;

    const isTechnician = role === "TECHNICIAN";

    useEffect(() => {
        if (profileLoading) return;

        const controller = new AbortController();

        async function fetchStats() {
            try {
                setError("");

                if (!companyId) {
                    throw new Error("No active company membership found.");
                }

                if (!dateRange.startDate || !dateRange.endDate) {
                    setTotalJobs(null);
                    setActiveJobs(null);
                    setTechnicians(null);
                    setRevenue(null);
                    setNewJobs(null);
                    setScheduledJobs(null);
                    setInProgressJobs(null);
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

                const queryParams = new URLSearchParams({
                    start_date: dateRange.startDate,
                    end_date: dateRange.endDate,
                });

                // Technician dashboard: only fetch jobs assigned to the logged-in technician.
                if (isTechnician) {
                    const jobsResponse = await fetch(
                        `${apiUrl}/api/companies/${companyId}/jobs/?${queryParams}`,
                        {
                            headers,
                            signal: controller.signal,
                        }
                    );

                    if (!jobsResponse.ok) {
                        throw new Error("Unable to load your assigned jobs.");
                    }

                    const jobs: ServiceJob[] = await jobsResponse.json();

                    setTotalJobs(jobs.length);
                    setNewJobs(
                        jobs.filter((job) => job.status === "NEW").length
                    );
                    setScheduledJobs(
                        jobs.filter((job) => job.status === "SCHEDULED").length
                    );
                    setInProgressJobs(
                        jobs.filter((job) => job.status === "IN_PROGRESS").length
                    );

                    return;
                }

                // Admin and Manager dashboard.
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

                const members: CompanyMember[] = await membersResponse.json();

                setTechnicians(
                    members.filter(
                        (member) =>
                            member.role === "TECHNICIAN" &&
                            member.status === "ACTIVE"
                    ).length
                );

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
    }, [
        profileLoading,
        companyId,
        isTechnician,
        dateRange.startDate,
        dateRange.endDate,
    ]);

    const stats = isTechnician
        ? [
            {
                label: "My Assigned Jobs",
                value: totalJobs,
                icon: "▤",
                description: "Jobs assigned to you",
            },
            {
                label: "New Jobs",
                value: newJobs,
                icon: "✦",
                description: "Awaiting scheduling",
            },
            {
                label: "Scheduled Jobs",
                value: scheduledJobs,
                icon: "◷",
                description: "Ready for work",
            },
            {
                label: "In Progress",
                value: inProgressJobs,
                icon: "⚙",
                description: "Currently being worked on",
            },
        ]
        : [
            {
                label: "Total Jobs",
                value: totalJobs,
                icon: "▤",
                description: "Selected date range",
            },
            {
                label: "Active Jobs",
                value: activeJobs,
                icon: "◷",
                description: "Selected date range",
            },
            {
                label: "Technicians",
                value: technicians,
                icon: "♙",
                description: "Current active team",
            },
            {
                label: "Revenue",
                value: revenue,
                icon: "₹",
                description: "Selected date range",
            },
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
                            {stat.description}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}
