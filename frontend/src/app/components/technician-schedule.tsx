"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "./current-user-provider";

interface TechnicianJob {
    id: string;
    title: string;
    status: string;
    priority: string;
    scheduled_start: string | null;
    scheduled_end: string | null;
}

interface TechnicianScheduleResponse {
    results?: TechnicianJob[];
}

function getLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatJobDate(dateValue: string): string {
    return new Date(dateValue).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function formatJobTime(dateValue: string): string {
    return new Date(dateValue).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
    });
}

function getStatusStyle(status: string): string {
    switch (status) {
        case "NEW":
            return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
        case "SCHEDULED":
            return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
        case "IN_PROGRESS":
            return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
        case "COMPLETED":
            return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";
        default:
            return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
}

function getPriorityStyle(priority: string): string {
    switch (priority) {
        case "URGENT":
            return "text-red-600 dark:text-red-400";
        case "HIGH":
            return "text-orange-600 dark:text-orange-400";
        case "MEDIUM":
            return "text-amber-600 dark:text-amber-400";
        default:
            return "text-slate-500 dark:text-slate-400";
    }
}

function formatStatus(status: string): string {
    return status.replaceAll("_", " ");
}

function JobCard({ job }: { job: TechnicianJob }) {
    return (
        <Link
            href={`/jobs/${job.id}`}
            className="block rounded-xl border border-slate-200 p-4 transition-colors hover:border-blue-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-blue-800 dark:hover:bg-slate-800/50"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">
                        {job.title}
                    </h4>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        {job.scheduled_start ? (
                            <span className="flex items-center gap-1">
                                <span>◷</span>
                                {formatJobTime(job.scheduled_start)}
                                {job.scheduled_end &&
                                    ` – ${formatJobTime(job.scheduled_end)}`}
                            </span>
                        ) : (
                            <span>Schedule not set</span>
                        )}

                        <span
                            className={`font-medium ${getPriorityStyle(
                                job.priority
                            )}`}
                        >
                            {job.priority} PRIORITY
                        </span>
                    </div>
                </div>

                <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(
                        job.status
                    )}`}
                >
                    {formatStatus(job.status)}
                </span>
            </div>

            <div className="mt-3 flex items-center justify-end text-xs font-medium text-blue-600 dark:text-blue-400">
                View job <span className="ml-1">→</span>
            </div>
        </Link>
    );
}

export function TechnicianSchedule() {
    const { user, loading: profileLoading } = useCurrentUser();

    const membership = user?.memberships?.[0];
    const companyId = membership?.company_id;
    const isTechnician = membership?.role === "TECHNICIAN";

    const [jobs, setJobs] = useState<TechnicianJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");
    const [processingJobId, setProcessingJobId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const fetchJobs = useCallback(async (signal: AbortSignal) => {
        if (!companyId) {
            setError("No active company membership found.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError("");

            const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
            const token = sessionStorage.getItem("accessToken");

            if (!apiUrl || !token) {
                throw new Error("API configuration or session is missing.");
            }

            const response = await fetch(
                `${apiUrl}/api/companies/${companyId}/jobs/`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    signal,
                }
            );

            if (!response.ok) {
                throw new Error("Unable to load your assigned jobs.");
            }

            const data = await response.json();

            const jobList: TechnicianJob[] = Array.isArray(data)
                ? data
                : (data as TechnicianScheduleResponse).results ?? [];

            setJobs(jobList);
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                return;
            }

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load your schedule."
            );
        } finally {
            if (!signal.aborted) {
                setLoading(false);
            }
        }
    }, [companyId]);

    useEffect(() => {
        if (profileLoading) return;

        if (!isTechnician) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        fetchJobs(controller.signal);

        return () => controller.abort();
    }, [profileLoading, isTechnician, fetchJobs, refreshKey]);

    const handleStatusChange = async (
        job: TechnicianJob,
        targetStatus: "IN_PROGRESS" | "COMPLETED"
    ) => {
        if (!companyId || processingJobId) return;

        try {
            setProcessingJobId(job.id);
            setActionError("");

            const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
            const token = sessionStorage.getItem("accessToken");

            if (!apiUrl || !token) {
                throw new Error("API configuration or session is missing.");
            }

            const response = await fetch(
                `${apiUrl}/api/companies/${companyId}/jobs/${job.id}/status/`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        status: targetStatus,
                    }),
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.detail || "Unable to update job status."
                );
            }

            setJobs((currentJobs) =>
                currentJobs.map((currentJob) =>
                    currentJob.id === job.id
                        ? { ...currentJob, status: targetStatus }
                        : currentJob
                )
            );

            window.dispatchEvent(
                new Event("serviceflow:technician-jobs-updated")
            );
        } catch (err) {
            setActionError(
                err instanceof Error
                    ? err.message
                    : "Unable to update job status."
            );
        } finally {
            setProcessingJobId(null);
        }
    };

    const { activeJobs, todayJobs, upcomingJobs } = useMemo(() => {
        const today = getLocalDateKey(new Date());

        const active = jobs.filter(
            (job) =>
                job.status !== "COMPLETED" &&
                job.status !== "CANCELLED"
        );

        const todayList: TechnicianJob[] = [];
        const upcomingList: TechnicianJob[] = [];

        active.forEach((job) => {
            if (!job.scheduled_start) return;

            const scheduledDate = getLocalDateKey(
                new Date(job.scheduled_start)
            );

            if (scheduledDate === today) {
                todayList.push(job);
            } else if (scheduledDate > today) {
                upcomingList.push(job);
            }
        });

        const sortByStart = (
            a: TechnicianJob,
            b: TechnicianJob
        ) =>
            new Date(a.scheduled_start!).getTime() -
            new Date(b.scheduled_start!).getTime();

        todayList.sort(sortByStart);
        upcomingList.sort(sortByStart);

        return {
            activeJobs: active,
            todayJobs: todayList,
            upcomingJobs: upcomingList,
        };
    }, [jobs]);

    if (profileLoading || !isTechnician) {
        return null;
    }

    return (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">
                        My Schedule
                    </h2>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Your assigned service jobs
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setRefreshKey((value) => value + 1)}
                    disabled={loading}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    {loading ? "Refreshing..." : "↻ Refresh"}
                </button>
            </div>

            {loading && (
                <div className="py-12 text-center text-sm text-slate-400">
                    Loading your schedule...
                </div>
            )}

            {!loading && error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <>
                    {/* My Active Jobs */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">
                                    My Active Jobs
                                </h3>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Start or complete your assigned work
                                </p>
                            </div>

                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                {activeJobs.length} jobs
                            </span>
                        </div>

                        {actionError && (
                            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                                {actionError}
                            </div>
                        )}

                        {activeJobs.length > 0 ? (
                            <div className="space-y-3">
                                {activeJobs.map((job) => (
                                    <div
                                        key={job.id}
                                        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                                    >
                                        <JobCard job={job} />

                                        {job.status === "SCHEDULED" && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleStatusChange(
                                                        job,
                                                        "IN_PROGRESS"
                                                    )
                                                }
                                                disabled={processingJobId !== null}
                                                className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                            >
                                                {processingJobId === job.id
                                                    ? "Starting..."
                                                    : "Start Work"}
                                            </button>
                                        )}

                                        {job.status === "IN_PROGRESS" && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleStatusChange(
                                                        job,
                                                        "COMPLETED"
                                                    )
                                                }
                                                disabled={processingJobId !== null}
                                                className="mt-3 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                            >
                                                {processingJobId === job.id
                                                    ? "Completing..."
                                                    : "Complete Job"}
                                            </button>
                                        )}

                                        {job.status === "NEW" && (
                                            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                                Waiting to be scheduled by your manager.
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                    No active jobs
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    New assignments will appear here.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Today's Jobs */}
                    <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold">
                                Today's Jobs
                            </h3>

                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                {todayJobs.length} jobs
                            </span>
                        </div>

                        {todayJobs.length > 0 ? (
                            <div className="space-y-3">
                                {todayJobs.map((job) => (
                                    <JobCard key={job.id} job={job} />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                    No jobs scheduled for today
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                    Your schedule is clear for today.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Upcoming Jobs */}
                    <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold">
                                Upcoming Jobs
                            </h3>

                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                {upcomingJobs.length} jobs
                            </span>
                        </div>

                        {upcomingJobs.length > 0 ? (
                            <div className="space-y-3">
                                {upcomingJobs.map((job) => (
                                    <div key={job.id} className="space-y-1">
                                        <p className="px-1 text-xs font-medium text-slate-400">
                                            {formatJobDate(job.scheduled_start!)}
                                        </p>

                                        <JobCard job={job} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                    No upcoming jobs
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                    New assignments will appear here.
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
