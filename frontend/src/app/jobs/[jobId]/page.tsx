"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "../../components/auth-guard";
import { useCurrentUser } from "../../components/current-user-provider";

interface ServiceJob {
    id: string;
    customer: string;
    service_address: string;
    assigned_technician: string | null;
    title: string;
    description: string;
    status: string;
    priority: string;
    labor_hours: string;
    labor_rate: string;
    scheduled_start: string | null;
    scheduled_end: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

interface Customer {
    id: string;
    name: string;
    email: string;
    phone: string;
}

interface ServiceAddress {
    id: string;
    label: string;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    is_primary: boolean;
}

interface CompanyMember {
    user: {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
    };
    role: string;
    status: string;
}

function formatLabel(value: string) {
    return value
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | null) {
    if (!value) return "Not available";

    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function formatAddress(address: ServiceAddress) {
    return [
        address.address_line_1,
        address.address_line_2,
        address.city,
        address.state,
        address.postal_code,
        address.country,
    ]
        .filter(Boolean)
        .join(", ");
}

function getErrorMessage(data: unknown, fallback: string) {
    if (data && typeof data === "object") {
        const details = data as Record<string, unknown>;

        if (typeof details.detail === "string") {
            return details.detail;
        }

        if (typeof details.error === "string") {
            return details.error;
        }

        if (typeof details.status === "string") {
            return details.status;
        }

        const firstFieldError = Object.values(details).find(
            (value) => Array.isArray(value) && typeof value[0] === "string"
        );

        if (Array.isArray(firstFieldError)) {
            return firstFieldError[0];
        }
    }

    return fallback;
}

function statusClasses(status: string) {
    switch (status) {
        case "COMPLETED":
            return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
        case "IN_PROGRESS":
            return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
        case "SCHEDULED":
            return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
        case "CANCELLED":
            return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
        default:
            return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
}

function priorityClasses(priority: string) {
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

function DetailItem({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {label}
            </p>
            <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-200">
                {value || "—"}
            </p>
        </div>
    );
}

function JobDetailsContent() {
    const params = useParams();
    const jobId = params.jobId as string;

    const { user, loading: userLoading } = useCurrentUser();

    const [job, setJob] = useState<ServiceJob | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [address, setAddress] = useState<ServiceAddress | null>(null);
    const [technicianName, setTechnicianName] = useState("Unassigned");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [statusUpdating, setStatusUpdating] = useState(false);
    const [statusError, setStatusError] = useState("");

    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [scheduledStart, setScheduledStart] = useState("");
    const [scheduledEnd, setScheduledEnd] = useState("");
    const [scheduleSaving, setScheduleSaving] = useState(false);
    const [scheduleError, setScheduleError] = useState("");

    const companyId = user?.memberships?.[0]?.company_id;
    const userRole = user?.memberships?.[0]?.role;
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    useEffect(() => {
        if (userLoading || !jobId) return;

        if (!companyId || !apiUrl) {
            setError("Company or API configuration is missing.");
            setLoading(false);
            return;
        }

        let active = true;

        async function fetchJobDetails() {
            setLoading(true);
            setError("");

            try {
                const token = sessionStorage.getItem("accessToken");

                if (!token) {
                    throw new Error("Your session has expired. Please log in again.");
                }

                const headers = {
                    Authorization: `Bearer ${token}`,
                };

                const jobResponse = await fetch(
                    `${apiUrl}/api/companies/${companyId}/jobs/${jobId}/`,
                    { headers }
                );

                const jobData = await jobResponse.json();

                if (!jobResponse.ok) {
                    throw new Error(
                        getErrorMessage(jobData, "Unable to load this service job.")
                    );
                }

                const jobDetails: ServiceJob = jobData;

                const [customersResponse, membersResponse] = await Promise.all([
                    fetch(
                        `${apiUrl}/api/companies/${companyId}/customers/`,
                        { headers }
                    ),
                    fetch(
                        `${apiUrl}/api/companies/${companyId}/members/`,
                        { headers }
                    ),
                ]);

                if (!customersResponse.ok || !membersResponse.ok) {
                    throw new Error("Unable to load related job information.");
                }

                const customersData: Customer[] = await customersResponse.json();
                const membersData: CompanyMember[] = await membersResponse.json();

                const matchedCustomer =
                    customersData.find(
                        (item) => item.id === jobDetails.customer
                    ) || null;

                let matchedAddress: ServiceAddress | null = null;

                if (jobDetails.customer && jobDetails.service_address) {
                    const addressResponse = await fetch(
                        `${apiUrl}/api/companies/${companyId}/customers/${jobDetails.customer}/addresses/`,
                        { headers }
                    );

                    if (addressResponse.ok) {
                        const addressesData: ServiceAddress[] =
                            await addressResponse.json();

                        matchedAddress =
                            addressesData.find(
                                (item) => item.id === jobDetails.service_address
                            ) || null;
                    }
                }

                const matchedTechnician = membersData.find(
                    (member) =>
                        member.user.id === jobDetails.assigned_technician
                );

                const technician = matchedTechnician
                    ? `${matchedTechnician.user.first_name} ${matchedTechnician.user.last_name}`.trim() ||
                    matchedTechnician.user.email
                    : jobDetails.assigned_technician
                        ? "Assigned technician"
                        : "Unassigned";

                if (active) {
                    setJob(jobDetails);
                    setCustomer(matchedCustomer);
                    setAddress(matchedAddress);
                    setTechnicianName(technician);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Something went wrong while loading job details."
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        fetchJobDetails();

        return () => {
            active = false;
        };
    }, [userLoading, companyId, apiUrl, jobId]);

    const isAdminOrManager =
        userRole === "COMPANY_ADMIN" || userRole === "MANAGER";

    const isAssignedTechnician =
        userRole === "TECHNICIAN" &&
        !!job?.assigned_technician &&
        job.assigned_technician === user?.id;

    const canSchedule =
        isAdminOrManager && job?.status === "NEW";

    const canRepairSchedule =
        isAdminOrManager &&
        job?.status === "SCHEDULED" &&
        (!job.scheduled_start || !job.scheduled_end);

    const canCancel =
        isAdminOrManager &&
        (job?.status === "NEW" || job?.status === "SCHEDULED");

    const canStart =
        isAssignedTechnician && job?.status === "SCHEDULED";

    const canComplete =
        isAssignedTechnician && job?.status === "IN_PROGRESS";

    async function updateJobStatus(targetStatus: string) {
        if (!job || !companyId || !apiUrl) return;

        if (
            targetStatus === "CANCELLED" &&
            !window.confirm("Are you sure you want to cancel this service job?")
        ) {
            return;
        }

        setStatusUpdating(true);
        setStatusError("");

        try {
            const token = sessionStorage.getItem("accessToken");

            if (!token) {
                throw new Error("Your session has expired. Please log in again.");
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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(data, "Unable to update job status.")
                );
            }

            setJob((previous) => {
                if (!previous) return previous;

                return {
                    ...previous,
                    status: data.status,
                    started_at: data.started_at,
                    completed_at: data.completed_at,
                    updated_at: new Date().toISOString(),
                };
            });
        } catch (err) {
            setStatusError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong while updating the job."
            );
        } finally {
            setStatusUpdating(false);
        }
    }

    async function saveSchedule() {
        if (!job || !companyId || !apiUrl) return;

        setScheduleError("");

        if (!scheduledStart || !scheduledEnd) {
            setScheduleError("Please select both scheduled start and end times.");
            return;
        }

        const startDate = new Date(scheduledStart);
        const endDate = new Date(scheduledEnd);

        if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime())
        ) {
            setScheduleError("Please enter valid scheduled dates.");
            return;
        }

        if (endDate <= startDate) {
            setScheduleError("Scheduled end must be later than scheduled start.");
            return;
        }

        setScheduleSaving(true);

        try {
            const token = sessionStorage.getItem("accessToken");

            if (!token) {
                throw new Error("Your session has expired. Please log in again.");
            }

            const patchResponse = await fetch(
                `${apiUrl}/api/companies/${companyId}/jobs/${job.id}/`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        scheduled_start: startDate.toISOString(),
                        scheduled_end: endDate.toISOString(),
                    }),
                }
            );

            const patchData = await patchResponse.json();

            if (!patchResponse.ok) {
                throw new Error(
                    getErrorMessage(patchData, "Unable to save the job schedule.")
                );
            }

            const updatedJob: ServiceJob = {
                ...job,
                ...patchData,
            };

            setJob(updatedJob);

            // Existing SCHEDULED jobs only need their missing dates repaired.
            // NEW jobs must also transition to SCHEDULED.
            if (job.status === "NEW") {
                const statusResponse = await fetch(
                    `${apiUrl}/api/companies/${companyId}/jobs/${job.id}/status/`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            status: "SCHEDULED",
                        }),
                    }
                );

                const statusData = await statusResponse.json();

                if (!statusResponse.ok) {
                    throw new Error(
                        getErrorMessage(
                            statusData,
                            "Dates were saved, but the job could not be scheduled. Please try again."
                        )
                    );
                }

                setJob((previous) => {
                    if (!previous) return previous;

                    return {
                        ...previous,
                        status: statusData.status,
                        started_at: statusData.started_at,
                        completed_at: statusData.completed_at,
                        updated_at: new Date().toISOString(),
                    };
                });
            }

            setShowScheduleForm(false);
            setScheduleError("");
            setScheduledStart("");
            setScheduledEnd("");
        } catch (err) {
            setScheduleError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong while saving the schedule."
            );
        } finally {
            setScheduleSaving(false);
        }
    }

    function openScheduleForm() {
        setScheduleError("");
        setScheduledStart(
            job?.scheduled_start
                ? new Date(job.scheduled_start).toISOString().slice(0, 16)
                : ""
        );
        setScheduledEnd(
            job?.scheduled_end
                ? new Date(job.scheduled_end).toISOString().slice(0, 16)
                : ""
        );
        setShowScheduleForm(true);
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-5xl">
                <Link
                    href="/jobs"
                    className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-blue-600 dark:text-slate-400"
                >
                    ← Back to Service Jobs
                </Link>

                {loading && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
                        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                            Loading job details...
                        </p>
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/30">
                        <h2 className="font-semibold text-red-700 dark:text-red-400">
                            Unable to load job
                        </h2>
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    </div>
                )}

                {!loading && !error && job && (
                    <>
                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                    Service Job
                                </p>
                                <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                                    {job.title}
                                </h1>
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                    Job ID: {job.id}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusClasses(job.status)}`}
                                >
                                    {formatLabel(job.status)}
                                </span>

                                <span
                                    className={`rounded-full bg-white px-3 py-1.5 text-xs font-semibold dark:bg-slate-900 ${priorityClasses(job.priority)}`}
                                >
                                    {formatLabel(job.priority)} Priority
                                </span>
                            </div>
                        </div>

                        {(canSchedule || canRepairSchedule || canCancel || canStart || canComplete) && (
                            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h2 className="font-semibold text-slate-900 dark:text-white">
                                            Job Actions
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            Available actions for your role and this job&apos;s current status.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {(canSchedule || canRepairSchedule) && (
                                            <button
                                                type="button"
                                                onClick={openScheduleForm}
                                                disabled={scheduleSaving || statusUpdating}
                                                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {canRepairSchedule ? "Set Schedule" : "Schedule Job"}
                                            </button>
                                        )}

                                        {canStart && (
                                            <button
                                                type="button"
                                                onClick={() => updateJobStatus("IN_PROGRESS")}
                                                disabled={statusUpdating}
                                                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {statusUpdating ? "Updating..." : "Start Work"}
                                            </button>
                                        )}

                                        {canComplete && (
                                            <button
                                                type="button"
                                                onClick={() => updateJobStatus("COMPLETED")}
                                                disabled={statusUpdating}
                                                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {statusUpdating ? "Updating..." : "Complete Job"}
                                            </button>
                                        )}

                                        {canCancel && (
                                            <button
                                                type="button"
                                                onClick={() => updateJobStatus("CANCELLED")}
                                                disabled={statusUpdating || scheduleSaving}
                                                className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                                            >
                                                {statusUpdating ? "Updating..." : "Cancel Job"}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {showScheduleForm && (
                                    <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
                                        <div className="mb-4">
                                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                                {job.status === "NEW" ? "Schedule Service Job" : "Complete Job Schedule"}
                                            </h3>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                Select when this service job is planned to start and finish.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div>
                                                <label
                                                    htmlFor="scheduled-start"
                                                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                                                >
                                                    Scheduled Start
                                                </label>
                                                <input
                                                    id="scheduled-start"
                                                    type="datetime-local"
                                                    value={scheduledStart}
                                                    onChange={(event) => setScheduledStart(event.target.value)}
                                                    disabled={scheduleSaving}
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                                />
                                            </div>

                                            <div>
                                                <label
                                                    htmlFor="scheduled-end"
                                                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                                                >
                                                    Scheduled End
                                                </label>
                                                <input
                                                    id="scheduled-end"
                                                    type="datetime-local"
                                                    value={scheduledEnd}
                                                    onChange={(event) => setScheduledEnd(event.target.value)}
                                                    disabled={scheduleSaving}
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                                />
                                            </div>
                                        </div>

                                        {scheduleError && (
                                            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                                                {scheduleError}
                                            </div>
                                        )}

                                        <div className="mt-5 flex flex-wrap justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowScheduleForm(false);
                                                    setScheduleError("");
                                                }}
                                                disabled={scheduleSaving}
                                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                Close
                                            </button>

                                            <button
                                                type="button"
                                                onClick={saveSchedule}
                                                disabled={scheduleSaving}
                                                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {scheduleSaving
                                                    ? "Saving Schedule..."
                                                    : job.status === "NEW"
                                                        ? "Save & Schedule"
                                                        : "Save Schedule"}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {statusError && (
                                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                                        {statusError}
                                    </div>
                                )}
                            </section>
                        )}

                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                            <section className="space-y-5 lg:col-span-2">
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Job Information
                                    </h2>

                                    <div className="mt-6">
                                        <DetailItem
                                            label="Description"
                                            value={job.description || "No description provided"}
                                        />
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <DetailItem
                                            label="Created On"
                                            value={formatDate(job.created_at)}
                                        />
                                        <DetailItem
                                            label="Last Updated"
                                            value={formatDate(job.updated_at)}
                                        />
                                        <DetailItem
                                            label="Started At"
                                            value={formatDate(job.started_at)}
                                        />
                                        <DetailItem
                                            label="Completed At"
                                            value={formatDate(job.completed_at)}
                                        />
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Customer Information
                                    </h2>

                                    {customer ? (
                                        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                                            <DetailItem
                                                label="Customer"
                                                value={customer.name}
                                            />
                                            <DetailItem
                                                label="Email"
                                                value={customer.email || "Not provided"}
                                            />
                                            <DetailItem
                                                label="Phone"
                                                value={customer.phone || "Not provided"}
                                            />
                                        </div>
                                    ) : (
                                        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                                            Customer information is unavailable.
                                        </p>
                                    )}
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Service Location
                                    </h2>

                                    {address ? (
                                        <div className="mt-5">
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                {address.label || "Service Address"}
                                                {address.is_primary && (
                                                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                                        Primary
                                                    </span>
                                                )}
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                                {formatAddress(address)}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                                            Service address information is unavailable.
                                        </p>
                                    )}
                                </div>
                            </section>

                            <aside className="space-y-5">
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Assignment
                                    </h2>

                                    <div className="mt-5">
                                        <DetailItem
                                            label="Assigned Technician"
                                            value={technicianName}
                                        />
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Schedule
                                    </h2>

                                    <div className="mt-5 space-y-5">
                                        <DetailItem
                                            label="Scheduled Start"
                                            value={formatDate(job.scheduled_start)}
                                        />
                                        <DetailItem
                                            label="Scheduled End"
                                            value={formatDate(job.scheduled_end)}
                                        />
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Labor
                                    </h2>

                                    <div className="mt-5 space-y-5">
                                        <DetailItem
                                            label="Labor Hours"
                                            value={job.labor_hours || "0.00"}
                                        />
                                        <DetailItem
                                            label="Labor Rate"
                                            value={`₹${Number(job.labor_rate || 0).toLocaleString("en-IN")}`}
                                        />
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}

export default function JobDetailsPage() {
    return (
        <AuthGuard>
            <JobDetailsContent />
        </AuthGuard>
    );
}
