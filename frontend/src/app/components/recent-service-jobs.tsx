"use client";

import { useEffect, useState } from "react";
import type { DashboardDateRange } from "./date-range-selector";

interface ServiceJob {
    id: string;
    title: string;
    status: string;
    priority: string;
    created_at: string;
}

interface Company {
    id: string;
    name: string;
}

interface RecentServiceJobsProps {
    dateRange: DashboardDateRange;
}

export function RecentServiceJobs({
    dateRange,
}: RecentServiceJobsProps) {
    const [jobs, setJobs] = useState<ServiceJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function fetchJobs() {
            try {
                setLoading(true);
                setError("");

                if (!dateRange.startDate || !dateRange.endDate) {
                    setJobs([]);
                    return;
                }

                const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
                const token = sessionStorage.getItem("accessToken");

                if (!apiUrl || !token) {
                    throw new Error(
                        "API configuration or session is missing."
                    );
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
                    throw new Error(
                        "Unable to load company information."
                    );
                }

                const companies: Company[] =
                    await companyResponse.json();

                if (companies.length === 0) {
                    throw new Error("No active company found.");
                }

                const queryParams = new URLSearchParams({
                    start_date: dateRange.startDate,
                    end_date: dateRange.endDate,
                });

                const jobResponse = await fetch(
                    `${apiUrl}/api/companies/${companies[0].id}/jobs/?${queryParams}`,
                    {
                        headers,
                        signal: controller.signal,
                    }
                );

                if (!jobResponse.ok) {
                    throw new Error("Unable to load service jobs.");
                }

                const data: ServiceJob[] = await jobResponse.json();

                setJobs(data.slice(0, 5));
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
                        : "Something went wrong."
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        fetchJobs();

        return () => controller.abort();
    }, [dateRange.startDate, dateRange.endDate]);

    function formatStatus(status: string) {
        return status
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function formatDate(date: string) {
        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }).format(new Date(date));
    }

    function statusStyle(status: string) {
        switch (status) {
            case "COMPLETED":
                return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
            case "IN_PROGRESS":
                return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
            case "NEW":
                return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
            default:
                return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
        }
    }

    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-5 dark:border-slate-800">
                <div>
                    <h3 className="font-semibold">Recent Service Jobs</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Your five latest jobs within the selected date range.
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                        <tr>
                            <th className="px-5 py-4 font-medium">Job</th>
                            <th className="px-5 py-4 font-medium">Priority</th>
                            <th className="px-5 py-4 font-medium">Created</th>
                            <th className="px-5 py-4 font-medium">Status</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="px-5 py-10 text-center text-slate-500"
                                >
                                    Loading service jobs...
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="px-5 py-10 text-center text-red-500"
                                >
                                    {error}
                                </td>
                            </tr>
                        ) : jobs.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="px-5 py-10 text-center text-slate-500"
                                >
                                    No service jobs found for this date range.
                                </td>
                            </tr>
                        ) : (
                            jobs.map((job) => (
                                <tr
                                    key={job.id}
                                    className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                >
                                    <td className="px-5 py-4">
                                        <p className="font-medium">
                                            {job.title}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            {job.id.slice(0, 8).toUpperCase()}
                                        </p>
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                                        {formatStatus(job.priority)}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                                        {formatDate(job.created_at)}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-4">
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(job.status)}`}
                                        >
                                            {formatStatus(job.status)}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
