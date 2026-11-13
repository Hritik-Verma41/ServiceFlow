"use client";

import { useEffect, useState } from "react";

interface Company {
    id: string;
}

interface ServiceJob {
    status: string;
}

const jobStatuses = [
    { key: "NEW", label: "New", color: "bg-amber-500" },
    { key: "SCHEDULED", label: "Scheduled", color: "bg-violet-500" },
    { key: "IN_PROGRESS", label: "In Progress", color: "bg-blue-500" },
    { key: "COMPLETED", label: "Completed", color: "bg-emerald-500" },
    { key: "CANCELLED", label: "Cancelled", color: "bg-slate-400" },
];

export function JobStatusBreakdown() {
    const [jobs, setJobs] = useState<ServiceJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchJobs() {
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

                const jobsResponse = await fetch(
                    `${apiUrl}/api/companies/${companies[0].id}/jobs/`,
                    { headers }
                );

                if (!jobsResponse.ok) {
                    throw new Error("Unable to load job information.");
                }

                const data: ServiceJob[] = await jobsResponse.json();
                setJobs(data);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load job status breakdown."
                );
            } finally {
                setLoading(false);
            }
        }

        fetchJobs();
    }, []);

    const totalJobs = jobs.length;

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6">
                <h3 className="font-semibold">Job Status Breakdown</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Overview of your service jobs by current status.
                </p>
            </div>

            {loading ? (
                <p className="py-8 text-center text-sm text-slate-500">
                    Loading job status...
                </p>
            ) : error ? (
                <p className="py-8 text-center text-sm text-red-500">
                    {error}
                </p>
            ) : totalJobs === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                    No service jobs available.
                </p>
            ) : (
                <div className="space-y-5">
                    {jobStatuses.map((status) => {
                        const count = jobs.filter(
                            (job) => job.status === status.key
                        ).length;

                        const percentage = (count / totalJobs) * 100;

                        return (
                            <div key={status.key}>
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {status.label}
                                    </span>

                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {count}
                                        <span className="ml-2 font-normal text-slate-400">
                                            ({percentage.toFixed(0)}%)
                                        </span>
                                    </span>
                                </div>

                                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${status.color}`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        Total Service Jobs
                    </span>
                    <span className="font-semibold">{loading ? "—" : totalJobs}</span>
                </div>
            </div>
        </section>
    );
}
