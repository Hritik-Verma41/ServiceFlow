"use client";

import { useEffect, useState } from "react";
import type { DashboardDateRange } from "./date-range-selector";

interface Activity {
    id: string;
    event_type: string;
    description: string;
    job: string | null;
    actor_name: string;
    created_at: string;
    metadata: Record<string, unknown>;
}

interface Company {
    id: string;
    name: string;
}

interface RecentActivityFeedProps {
    dateRange: DashboardDateRange;
}

export function RecentActivityFeed({
    dateRange,
}: RecentActivityFeedProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function fetchActivities() {
            try {
                setLoading(true);
                setError("");

                if (!dateRange.startDate || !dateRange.endDate) {
                    setActivities([]);
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

                const response = await fetch(
                    `${apiUrl}/api/companies/${companies[0].id}/activities/?${queryParams}`,
                    {
                        headers,
                        signal: controller.signal,
                    }
                );

                if (!response.ok) {
                    throw new Error("Unable to load recent activity.");
                }

                const data: Activity[] = await response.json();
                setActivities(data);
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

        fetchActivities();

        return () => controller.abort();
    }, [dateRange.startDate, dateRange.endDate]);

    function formatEventType(eventType: string) {
        return eventType
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function formatDate(date: string) {
        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(date));
    }

    function eventStyle(eventType: string) {
        switch (eventType) {
            case "JOB_CREATED":
                return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
            case "JOB_STATUS_CHANGED":
                return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
            case "TECHNICIAN_ASSIGNED":
                return "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
            case "NOTE_ADDED":
                return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
            case "INVOICE_CREATED":
                return "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300";
            case "PAYMENT_RECEIVED":
                return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
            default:
                return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
        }
    }

    return (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
                <h3 className="font-semibold">Recent Activity</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Keep track of what's happening across your operations.
                </p>
            </div>

            <div className="p-5">
                {loading ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                        Loading recent activity...
                    </p>
                ) : error ? (
                    <p className="py-8 text-center text-sm text-red-500">
                        {error}
                    </p>
                ) : activities.length === 0 ? (
                    <div className="py-8 text-center">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            No activity found for this date range
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                            Activity events will appear here as your team works.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {activities.map((activity) => (
                            <div key={activity.id} className="flex gap-3">
                                <div className="mt-0.5 shrink-0">
                                    <span
                                        className={`inline-flex rounded-lg px-2 py-1 text-xs font-medium ${eventStyle(activity.event_type)}`}
                                    >
                                        {formatEventType(activity.event_type)}
                                    </span>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        {activity.description}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {activity.actor_name} · {formatDate(activity.created_at)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
