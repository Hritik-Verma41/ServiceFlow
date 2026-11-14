"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthGuard } from "@/app/components/auth-guard";
import { useCurrentUser } from "@/app/components/current-user-provider";

interface ServiceJob {
    id: string;
    company: string;
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
    id: string;
    user: {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
    };
    role: string;
    status: string;
}

interface TechnicianWorkload {
    technician_id: string;
    name: string;
    email: string;
    open_job_count: number;
}

interface JobActivity {
    id: string;
    event_type: string;
    description: string;
    actor_name: string;
    created_at: string;
    metadata: Record<string, unknown>;
}

function formatLabel(value: string) {
    return value
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
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

function getErrorMessage(
    data: Record<string, unknown>,
    fallback: string
) {
    if (typeof data.detail === "string") return data.detail;

    if (typeof data.error === "string") return data.error;

    const firstValue = Object.values(data)[0];

    if (Array.isArray(firstValue) && typeof firstValue[0] === "string") {
        return firstValue[0];
    }

    if (typeof firstValue === "string") return firstValue;

    return fallback;
}

function statusClasses(status: string) {
    const classes: Record<string, string> = {
        NEW: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
        SCHEDULED:
            "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400",
        IN_PROGRESS:
            "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
        COMPLETED:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
        CANCELLED:
            "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
    };

    return (
        classes[status] ||
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
    );
}

function priorityClasses(priority: string) {
    const classes: Record<string, string> = {
        LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        MEDIUM:
            "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
        HIGH: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
        URGENT: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
    };

    return (
        classes[priority] ||
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
    );
}

function activityColor(eventType: string) {
    const colors: Record<string, string> = {
        JOB_CREATED:
            "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
        JOB_STATUS_CHANGED:
            "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400",
        TECHNICIAN_ASSIGNED:
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
        NOTE_ADDED:
            "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
    };

    return (
        colors[eventType] ||
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
    );
}

function activityIcon(eventType: string) {
    const icons: Record<string, string> = {
        JOB_CREATED: "+",
        JOB_STATUS_CHANGED: "↻",
        TECHNICIAN_ASSIGNED: "✓",
        NOTE_ADDED: "✎",
    };

    return icons[eventType] || "•";
}

function DetailItem({
    label,
    value,
}: {
    label: string;
    value: string | number;
}) {
    return (
        <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {label}
            </p>
            <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-200">
                {value || "Not available"}
            </p>
        </div>
    );
}

function JobDetailsContent() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: userLoading } = useCurrentUser();

    const jobId = params.jobId as string;
    const companyId = user?.memberships?.[0]?.company_id;
    const userRole = user?.memberships?.[0]?.role;
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    const [job, setJob] = useState<ServiceJob | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [address, setAddress] = useState<ServiceAddress | null>(null);
    const [technicianName, setTechnicianName] = useState("Unassigned");
    const [technicians, setTechnicians] = useState<CompanyMember[]>([]);
    const [selectedTechnician, setSelectedTechnician] = useState("");

    const [technicianWorkloads, setTechnicianWorkloads] = useState<
        TechnicianWorkload[]
    >([]);
    const [workloadLoading, setWorkloadLoading] = useState(false);
    const [workloadError, setWorkloadError] = useState("");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [statusUpdating, setStatusUpdating] = useState(false);
    const [statusError, setStatusError] = useState("");

    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [scheduledStart, setScheduledStart] = useState("");
    const [scheduledEnd, setScheduledEnd] = useState("");
    const [scheduleSaving, setScheduleSaving] = useState(false);
    const [scheduleError, setScheduleError] = useState("");

    const [assignmentSaving, setAssignmentSaving] = useState(false);
    const [assignmentError, setAssignmentError] = useState("");

    const [activities, setActivities] = useState<JobActivity[]>([]);
    const [activityLoading, setActivityLoading] = useState(true);
    const [activityError, setActivityError] = useState("");

    const fetchActivities = useCallback(async () => {
        if (!companyId || !apiUrl || !jobId) return;

        setActivityLoading(true);
        setActivityError("");

        try {
            const token = sessionStorage.getItem("accessToken");

            if (!token) {
                throw new Error(
                    "Your session has expired. Please log in again."
                );
            }

            const response = await fetch(
                `${apiUrl}/api/companies/${companyId}/jobs/${jobId}/activities/`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(data, "Unable to load job activity.")
                );
            }

            setActivities(
                Array.isArray(data)
                    ? data
                    : Array.isArray(data.results)
                        ? data.results
                        : []
            );
        } catch (err) {
            setActivityError(
                err instanceof Error
                    ? err.message
                    : "Unable to load job activity."
            );
        } finally {
            setActivityLoading(false);
        }
    }, [companyId, apiUrl, jobId]);

    const fetchTechnicianWorkload = useCallback(async () => {
        if (!companyId || !apiUrl) return;

        setWorkloadLoading(true);
        setWorkloadError("");

        try {
            const token = sessionStorage.getItem("accessToken");

            if (!token) {
                throw new Error(
                    "Your session has expired. Please log in again."
                );
            }

            const response = await fetch(
                `${apiUrl}/api/companies/${companyId}/technician-workload/`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to load technician workloads."
                    )
                );
            }

            setTechnicianWorkloads(
                Array.isArray(data.results) ? data.results : []
            );
        } catch (err) {
            setWorkloadError(
                err instanceof Error
                    ? err.message
                    : "Unable to load technician workloads."
            );
        } finally {
            setWorkloadLoading(false);
        }
    }, [companyId, apiUrl]);

    useEffect(() => {
        if (userLoading || !companyId || !apiUrl || !jobId) return;

        let active = true;

        async function fetchJobDetails() {
            setLoading(true);
            setError("");

            try {
                const token = sessionStorage.getItem("accessToken");

                if (!token) {
                    throw new Error(
                        "Your session has expired. Please log in again."
                    );
                }

                const headers = {
                    Authorization: `Bearer ${token}`,
                };

                const [jobResponse, customersResponse, membersResponse] =
                    await Promise.all([
                        fetch(
                            `${apiUrl}/api/companies/${companyId}/jobs/${jobId}/`,
                            { headers }
                        ),
                        fetch(
                            `${apiUrl}/api/companies/${companyId}/customers/`,
                            { headers }
                        ),
                        fetch(
                            `${apiUrl}/api/companies/${companyId}/members/`,
                            { headers }
                        ),
                    ]);

                const jobDetails = await jobResponse.json();
                const customersData = await customersResponse.json();
                const membersData = await membersResponse.json();

                if (!jobResponse.ok) {
                    throw new Error(
                        getErrorMessage(
                            jobDetails,
                            "Unable to load job details."
                        )
                    );
                }

                if (!customersResponse.ok) {
                    throw new Error(
                        getErrorMessage(
                            customersData,
                            "Unable to load customer information."
                        )
                    );
                }

                if (!membersResponse.ok) {
                    throw new Error(
                        getErrorMessage(
                            membersData,
                            "Unable to load company members."
                        )
                    );
                }

                const customers: Customer[] = Array.isArray(customersData)
                    ? customersData
                    : customersData.results || [];

                const members: CompanyMember[] = Array.isArray(membersData)
                    ? membersData
                    : membersData.results || [];

                const matchedCustomer =
                    customers.find(
                        (item) => item.id === jobDetails.customer
                    ) || null;

                let matchedAddress: ServiceAddress | null = null;

                if (jobDetails.customer) {
                    const addressResponse = await fetch(
                        `${apiUrl}/api/companies/${companyId}/customers/${jobDetails.customer}/addresses/`,
                        { headers }
                    );

                    const addressData = await addressResponse.json();

                    if (addressResponse.ok) {
                        const addresses: ServiceAddress[] =
                            Array.isArray(addressData)
                                ? addressData
                                : addressData.results || [];

                        matchedAddress =
                            addresses.find(
                                (item) =>
                                    item.id === jobDetails.service_address
                            ) || null;
                    }
                }

                const matchedTechnician = members.find(
                    (member) =>
                        member.user.id === jobDetails.assigned_technician
                );

                const technician = matchedTechnician
                    ? `${matchedTechnician.user.first_name} ${matchedTechnician.user.last_name}`.trim() ||
                    matchedTechnician.user.email
                    : "Unassigned";

                if (active) {
                    setJob(jobDetails);
                    setCustomer(matchedCustomer);
                    setAddress(matchedAddress);
                    setTechnicianName(technician);

                    setSelectedTechnician(
                        jobDetails.assigned_technician || ""
                    );

                    setTechnicians(
                        members.filter(
                            (member) => member.role === "TECHNICIAN"
                        )
                    );
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

    useEffect(() => {
        if (userLoading || !companyId || !apiUrl || !jobId) return;

        fetchActivities();
    }, [userLoading, companyId, apiUrl, jobId, fetchActivities]);

    useEffect(() => {
        if (
            userLoading ||
            !companyId ||
            !apiUrl ||
            (userRole !== "COMPANY_ADMIN" && userRole !== "MANAGER")
        ) {
            return;
        }

        fetchTechnicianWorkload();
    }, [
        userLoading,
        companyId,
        apiUrl,
        userRole,
        fetchTechnicianWorkload,
    ]);

    const isAdminOrManager =
        userRole === "COMPANY_ADMIN" || userRole === "MANAGER";

    const isAssignedTechnician =
        userRole === "TECHNICIAN" &&
        !!job?.assigned_technician &&
        job.assigned_technician === user?.id;

    const canSchedule =
        isAdminOrManager &&
        job?.status === "NEW" &&
        !!job?.assigned_technician;

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
            !window.confirm(
                "Are you sure you want to cancel this service job?"
            )
        ) {
            return;
        }

        setStatusUpdating(true);
        setStatusError("");

        try {
            const token = sessionStorage.getItem("accessToken");

            if (!token) {
                throw new Error(
                    "Your session has expired. Please log in again."
                );
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
                };
            });

            await fetchActivities();
            await fetchTechnicianWorkload();
        } catch (err) {
            setStatusError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong while updating job status."
            );
        } finally {
            setStatusUpdating(false);
        }
    }

    function openScheduleForm() {
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

        setScheduleError("");
        setShowScheduleForm(true);
    }

    async function saveSchedule() {
        if (!job || !companyId || !apiUrl) return;

        if (!scheduledStart || !scheduledEnd) {
            setScheduleError(
                "Please provide both scheduled start and end dates."
            );
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
            setScheduleError(
                "Scheduled end must be later than scheduled start."
            );
            return;
        }

        if (job.status === "NEW" && !job.assigned_technician) {
            setScheduleError(
                "Assign a technician before scheduling this job."
            );
            return;
        }

        setScheduleSaving(true);
        setScheduleError("");

        try {
            const token = sessionStorage.getItem("accessToken");

            if (!token) {
                throw new Error(
                    "Your session has expired. Please log in again."
                );
            }

            const response = await fetch(
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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(data, "Unable to save job schedule.")
                );
            }

            setJob((previous) =>
                previous
                    ? {
                        ...previous,
                        scheduled_start: data.scheduled_start,
                        scheduled_end: data.scheduled_end,
                    }
                    : previous
            );

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
                            "Schedule saved, but the job status could not be updated."
                        )
                    );
                }

                setJob((previous) =>
                    previous
                        ? {
                            ...previous,
                            status: statusData.status,
                            started_at: statusData.started_at,
                            completed_at: statusData.completed_at,
                        }
                        : previous
                );
            }

            setShowScheduleForm(false);
            await fetchActivities();
            await fetchTechnicianWorkload();
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

    async function saveAssignment() {
        if (!job || !companyId || !apiUrl) return;

        if (!selectedTechnician) {
            setAssignmentError("Please select a technician.");
            return;
        }

        if (selectedTechnician === job.assigned_technician) {
            setAssignmentError(
                "This technician is already assigned."
            );
            return;
        }

        setAssignmentSaving(true);
        setAssignmentError("");

        try {
            const token = sessionStorage.getItem("accessToken");

            if (!token) {
                throw new Error(
                    "Your session has expired. Please log in again."
                );
            }

            const response = await fetch(
                `${apiUrl}/api/companies/${companyId}/jobs/${job.id}/`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        assigned_technician: selectedTechnician,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(data, "Unable to assign technician.")
                );
            }

            const assignedId =
                data.assigned_technician || selectedTechnician;

            const matchedTechnician = technicians.find(
                (member) => member.user.id === assignedId
            );

            const name = matchedTechnician
                ? `${matchedTechnician.user.first_name} ${matchedTechnician.user.last_name}`.trim() ||
                matchedTechnician.user.email
                : "Assigned technician";

            setJob((previous) =>
                previous
                    ? {
                        ...previous,
                        assigned_technician: assignedId,
                    }
                    : previous
            );

            setSelectedTechnician(assignedId);
            setTechnicianName(name);

            await fetchActivities();
            await fetchTechnicianWorkload();
        } catch (err) {
            setAssignmentError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong while assigning the technician."
            );
        } finally {
            setAssignmentSaving(false);
        }
    }

    if (loading || userLoading) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
                <div className="mx-auto max-w-6xl">
                    <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                    <div className="mt-6 h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
                </div>
            </main>
        );
    }

    if (error || !job) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
                <div className="mx-auto max-w-6xl">
                    <button
                        type="button"
                        onClick={() => router.push("/jobs")}
                        className="mb-6 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                        ← Back to Jobs
                    </button>

                    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                        {error || "Job not found."}
                    </div>
                </div>
            </main>
        );
    }

    const activeTechnicians = technicians.filter(
        (member) => member.status === "ACTIVE"
    );

    const sortedTechnicianWorkloads = [...technicianWorkloads].sort(
        (a, b) => b.open_job_count - a.open_job_count
    );

    const maxTechnicianWorkload = Math.max(
        1,
        ...technicianWorkloads.map((item) => item.open_job_count)
    );

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
                <button
                    type="button"
                    onClick={() => router.push("/jobs")}
                    className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                >
                    ← Back to Jobs
                </button>

                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            Service Job
                        </p>

                        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                            {job.title}
                        </h1>

                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Created {formatDate(job.created_at)}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <span
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusClasses(job.status)}`}
                        >
                            {formatLabel(job.status)}
                        </span>

                        <span
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${priorityClasses(job.priority)}`}
                        >
                            {formatLabel(job.priority)} Priority
                        </span>
                    </div>
                </div>

                {(isAdminOrManager ||
                    canStart ||
                    canComplete ||
                    canCancel) && (
                        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Job Actions
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Manage this job based on its current status.
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
                                            {canRepairSchedule
                                                ? "Set Schedule"
                                                : "Schedule Job"}
                                        </button>
                                    )}

                                    {canStart && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateJobStatus("IN_PROGRESS")
                                            }
                                            disabled={statusUpdating}
                                            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {statusUpdating
                                                ? "Updating..."
                                                : "Start Work"}
                                        </button>
                                    )}

                                    {canComplete && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateJobStatus("COMPLETED")
                                            }
                                            disabled={statusUpdating}
                                            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {statusUpdating
                                                ? "Updating..."
                                                : "Complete Job"}
                                        </button>
                                    )}

                                    {canCancel && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateJobStatus("CANCELLED")
                                            }
                                            disabled={statusUpdating || scheduleSaving}
                                            className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                                        >
                                            {statusUpdating
                                                ? "Updating..."
                                                : "Cancel Job"}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {job.status === "NEW" &&
                                !job.assigned_technician &&
                                isAdminOrManager && (
                                    <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                        Assign a technician before scheduling this job.
                                    </p>
                                )}

                            {showScheduleForm && (
                                <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
                                    <div className="mb-4">
                                        <h3 className="font-semibold text-slate-900 dark:text-white">
                                            {job.status === "NEW"
                                                ? "Schedule Service Job"
                                                : "Complete Job Schedule"}
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
                                                onChange={(event) =>
                                                    setScheduledStart(event.target.value)
                                                }
                                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
                                                onChange={(event) =>
                                                    setScheduledEnd(event.target.value)
                                                }
                                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
                                    value={
                                        job.description ||
                                        "No description provided"
                                    }
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

                        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Activity History
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        A chronological record of events for this job.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={fetchActivities}
                                    disabled={activityLoading}
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    {activityLoading
                                        ? "Refreshing..."
                                        : "Refresh"}
                                </button>
                            </div>

                            {activityError && (
                                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                                    {activityError}

                                    <button
                                        type="button"
                                        onClick={fetchActivities}
                                        className="ml-2 font-semibold underline"
                                    >
                                        Try again
                                    </button>
                                </div>
                            )}

                            {activityLoading && activities.length === 0 && (
                                <div className="mt-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
                                    Loading activity...
                                </div>
                            )}

                            {!activityLoading &&
                                !activityError &&
                                activities.length === 0 && (
                                    <div className="mt-6 rounded-xl bg-slate-50 px-4 py-8 text-center dark:bg-slate-950">
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            No activity recorded yet
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Job updates and actions will appear here.
                                        </p>
                                    </div>
                                )}

                            {activities.length > 0 && (
                                <div className="mt-6">
                                    {activities.map((activity, index) => (
                                        <div
                                            key={activity.id}
                                            className="relative flex gap-4 pb-7 last:pb-0"
                                        >
                                            {index !== activities.length - 1 && (
                                                <div className="absolute left-[17px] top-10 h-full w-px bg-slate-200 dark:bg-slate-700" />
                                            )}

                                            <div
                                                className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${activityColor(activity.event_type)}`}
                                            >
                                                {activityIcon(activity.event_type)}
                                            </div>

                                            <div className="min-w-0 flex-1 pt-0.5">
                                                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                        {formatLabel(
                                                            activity.event_type
                                                        )}
                                                    </p>

                                                    <time className="text-xs text-slate-400 dark:text-slate-500">
                                                        {formatDate(
                                                            activity.created_at
                                                        )}
                                                    </time>
                                                </div>

                                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                                                    {activity.description}
                                                </p>

                                                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                                                    By{" "}
                                                    {activity.actor_name ||
                                                        "System"}
                                                </p>

                                                {activity.event_type ===
                                                    "JOB_STATUS_CHANGED" &&
                                                    typeof activity.metadata
                                                        ?.old_status ===
                                                    "string" &&
                                                    typeof activity.metadata
                                                        ?.new_status ===
                                                    "string" && (
                                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                                            <span
                                                                className={`rounded-full px-2 py-1 font-medium ${statusClasses(activity.metadata.old_status)}`}
                                                            >
                                                                {formatLabel(
                                                                    activity.metadata.old_status
                                                                )}
                                                            </span>

                                                            <span className="text-slate-400">
                                                                →
                                                            </span>

                                                            <span
                                                                className={`rounded-full px-2 py-1 font-medium ${statusClasses(activity.metadata.new_status)}`}
                                                            >
                                                                {formatLabel(
                                                                    activity.metadata.new_status
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
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

                            {isAdminOrManager && (
                                <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
                                    <div className="mb-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                Current Technician Workload
                                            </h3>

                                            <button
                                                type="button"
                                                onClick={fetchTechnicianWorkload}
                                                disabled={workloadLoading}
                                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-400"
                                            >
                                                {workloadLoading
                                                    ? "Refreshing..."
                                                    : "Refresh"}
                                            </button>
                                        </div>

                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Number of active jobs assigned to each technician.
                                        </p>

                                        {workloadLoading &&
                                            technicianWorkloads.length === 0 && (
                                                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                                                    Loading technician workloads...
                                                </p>
                                            )}

                                        {workloadError && (
                                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                                                {workloadError}
                                            </div>
                                        )}

                                        {!workloadLoading &&
                                            !workloadError &&
                                            technicianWorkloads.length === 0 && (
                                                <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                                                    No active technicians found.
                                                </p>
                                            )}

                                        {sortedTechnicianWorkloads.length > 0 && (
                                            <div className="mt-4 space-y-4">
                                                {sortedTechnicianWorkloads.map(
                                                    (technician) => {
                                                        const isSelected =
                                                            selectedTechnician ===
                                                            technician.technician_id;

                                                        const barWidth =
                                                            technician.open_job_count ===
                                                                0
                                                                ? 0
                                                                : Math.max(
                                                                    5,
                                                                    (technician.open_job_count /
                                                                        maxTechnicianWorkload) *
                                                                    100
                                                                );

                                                        return (
                                                            <div
                                                                key={technician.technician_id}
                                                                className={`rounded-lg p-2 ${isSelected
                                                                    ? "bg-blue-50 dark:bg-blue-950/30"
                                                                    : ""
                                                                    }`}
                                                            >
                                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                                                                            {technician.name}
                                                                            {isSelected && (
                                                                                <span className="ml-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                                                                                    Selected
                                                                                </span>
                                                                            )}
                                                                        </p>

                                                                        <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                                                                            {technician.email}
                                                                        </p>
                                                                    </div>

                                                                    <span className="shrink-0 text-sm font-bold tabular-nums text-slate-700 dark:text-slate-300">
                                                                        {technician.open_job_count}
                                                                        <span className="ml-1 text-xs font-normal text-slate-500">
                                                                            {technician.open_job_count ===
                                                                                1
                                                                                ? "job"
                                                                                : "jobs"}
                                                                        </span>
                                                                    </span>
                                                                </div>

                                                                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-500 ${isSelected
                                                                            ? "bg-blue-600"
                                                                            : "bg-violet-500"
                                                                            }`}
                                                                        style={{
                                                                            width: `${barWidth}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        )}

                                        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                                            Includes New, Scheduled, and In Progress jobs. Completed and Cancelled jobs are excluded.
                                        </p>
                                    </div>

                                    <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                                        <label
                                            htmlFor="assigned-technician"
                                            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                                        >
                                            {job.assigned_technician
                                                ? "Change Technician"
                                                : "Assign Technician"}
                                        </label>

                                        <select
                                            id="assigned-technician"
                                            value={selectedTechnician}
                                            onChange={(event) =>
                                                setSelectedTechnician(
                                                    event.target.value
                                                )
                                            }
                                            disabled={assignmentSaving}
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                        >
                                            <option value="">
                                                Choose a technician
                                            </option>

                                            {technicians
                                                .filter(
                                                    (member) =>
                                                        member.status === "ACTIVE" ||
                                                        member.user.id ===
                                                        job.assigned_technician
                                                )
                                                .map((member) => {
                                                    const name =
                                                        `${member.user.first_name} ${member.user.last_name}`.trim() ||
                                                        member.user.email;

                                                    return (
                                                        <option
                                                            key={member.user.id}
                                                            value={member.user.id}
                                                        >
                                                            {name}
                                                            {member.status !==
                                                                "ACTIVE"
                                                                ? " (Inactive)"
                                                                : ""}
                                                        </option>
                                                    );
                                                })}
                                        </select>

                                        {activeTechnicians.length === 0 && (
                                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                                No active technicians are available. Activate or invite a technician from Team Management.
                                            </p>
                                        )}

                                        {assignmentError && (
                                            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                                                {assignmentError}
                                            </p>
                                        )}

                                        <button
                                            type="button"
                                            onClick={saveAssignment}
                                            disabled={
                                                assignmentSaving ||
                                                !selectedTechnician ||
                                                selectedTechnician ===
                                                job.assigned_technician ||
                                                activeTechnicians.length === 0
                                            }
                                            className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {assignmentSaving
                                                ? "Saving..."
                                                : job.assigned_technician
                                                    ? "Update Assignment"
                                                    : "Assign Technician"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {job.status === "NEW" &&
                                !job.assigned_technician && (
                                    <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                        Assign a technician before scheduling this job.
                                    </p>
                                )}
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
                                    value={`₹${Number(
                                        job.labor_rate || 0
                                    ).toLocaleString("en-IN")}`}
                                />
                            </div>
                        </div>
                    </aside>
                </div>
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
