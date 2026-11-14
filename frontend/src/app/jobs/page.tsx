"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "../components/auth-guard";
import { useCurrentUser } from "../components/current-user-provider";

interface ServiceJob {
    id: string;
    customer: string;
    assigned_technician: string | null;
    title: string;
    description: string;
    status: string;
    priority: string;
    scheduled_start: string | null;
    scheduled_end: string | null;
    created_at: string;
}

interface Customer {
    id: string;
    name: string;
    is_active: boolean;
}

interface CompanyMember {
    id: string;
    user: {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
    };
    role: string;
    status: string;
}

interface Technician {
    id: string;
    name: string;
    email: string;
}

interface ServiceAddress {
    id: string;
    customer: string;
    label: string;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    is_primary: boolean;
}

const STATUS_OPTIONS = [
    "NEW",
    "SCHEDULED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
];

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function formatLabel(value: string) {
    return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) =>
        char.toUpperCase()
    );
}

function formatDate(value: string | null) {
    if (!value) return "Not scheduled";

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

function getErrorMessage(data: unknown, fallback: string): string {
    if (typeof data === "string") return data;

    if (data && typeof data === "object") {
        const details = data as Record<string, unknown>;

        if (typeof details.detail === "string") {
            return details.detail;
        }

        if (typeof details.error === "string") {
            return details.error;
        }

        const firstError = Object.values(details).flat()[0];

        if (typeof firstError === "string") {
            return firstError;
        }
    }

    return fallback;
}

function JobsContent() {
    const { user, loading: userLoading } = useCurrentUser();

    const [jobs, setJobs] = useState<ServiceJob[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState("");
    const [addresses, setAddresses] = useState<ServiceAddress[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState("");
    const [addressesLoading, setAddressesLoading] = useState(false);
    const [addressError, setAddressError] = useState("");

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("MEDIUM");
    const [technicianId, setTechnicianId] = useState("");
    const [scheduledStart, setScheduledStart] = useState("");
    const [scheduledEnd, setScheduledEnd] = useState("");

    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    const companyId = user?.memberships?.[0]?.company_id;
    const role = user?.memberships?.[0]?.role;

    const canManageJobs =
        role === "COMPANY_ADMIN" || role === "MANAGER";

    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    useEffect(() => {
        if (userLoading) return;

        if (!companyId) {
            setError("No active company membership was found.");
            setLoading(false);
            return;
        }

        let active = true;

        async function fetchJobs() {
            setLoading(true);
            setError("");

            try {
                const token = sessionStorage.getItem("accessToken");

                if (!apiUrl || !token) {
                    throw new Error("API configuration or session is missing.");
                }

                const headers = {
                    Authorization: `Bearer ${token}`,
                };

                const requests = [
                    fetch(`${apiUrl}/api/companies/${companyId}/jobs/`, {
                        headers,
                    }),
                    fetch(`${apiUrl}/api/companies/${companyId}/customers/`, {
                        headers,
                    }),
                ];

                if (canManageJobs) {
                    requests.push(
                        fetch(`${apiUrl}/api/companies/${companyId}/members/`, {
                            headers,
                        })
                    );
                }

                const responses = await Promise.all(requests);

                if (responses.some((response) => !response.ok)) {
                    throw new Error("Unable to load service job data.");
                }

                const jobsData: ServiceJob[] = await responses[0].json();
                const customersData: Customer[] = await responses[1].json();

                let techniciansData: Technician[] = [];

                if (canManageJobs && responses[2]) {
                    const membersData: CompanyMember[] =
                        await responses[2].json();

                    techniciansData = membersData
                        .filter(
                            (member) =>
                                member.role === "TECHNICIAN" &&
                                member.status === "ACTIVE"
                        )
                        .map((member) => ({
                            id: member.user.id,
                            name:
                                `${member.user.first_name} ${member.user.last_name}`.trim() ||
                                member.user.email,
                            email: member.user.email,
                        }));
                }

                if (active) {
                    setJobs(jobsData);
                    setCustomers(customersData);
                    setTechnicians(techniciansData);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Something went wrong while loading jobs."
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        fetchJobs();

        return () => {
            active = false;
        };
    }, [companyId, userLoading, canManageJobs, apiUrl]);

    const customerNames = useMemo(
        () => new Map(customers.map((customer) => [customer.id, customer.name])),
        [customers]
    );

    const activeCustomers = useMemo(
        () => customers.filter((customer) => customer.is_active),
        [customers]
    );

    const filteredJobs = useMemo(() => {
        return jobs.filter((job) => {
            const customerName = customerNames.get(job.customer) || "";

            const matchesSearch =
                job.title.toLowerCase().includes(search.toLowerCase()) ||
                customerName.toLowerCase().includes(search.toLowerCase());

            const matchesStatus =
                statusFilter === "ALL" || job.status === statusFilter;

            const matchesPriority =
                priorityFilter === "ALL" || job.priority === priorityFilter;

            return matchesSearch && matchesStatus && matchesPriority;
        });
    }, [jobs, customerNames, search, statusFilter, priorityFilter]);

    const counts = useMemo(
        () => ({
            total: jobs.length,
            active: jobs.filter((job) =>
                ["NEW", "SCHEDULED", "IN_PROGRESS"].includes(job.status)
            ).length,
            inProgress: jobs.filter((job) => job.status === "IN_PROGRESS")
                .length,
            completed: jobs.filter((job) => job.status === "COMPLETED").length,
        }),
        [jobs]
    );

    useEffect(() => {
        if (!modalOpen || !selectedCustomerId || !companyId) {
            setAddresses([]);
            setSelectedAddressId("");
            setAddressError("");
            return;
        }

        let active = true;

        async function fetchAddresses() {
            setAddressesLoading(true);
            setAddresses([]);
            setSelectedAddressId("");
            setAddressError("");

            try {
                const token = sessionStorage.getItem("accessToken");

                if (!apiUrl || !token) {
                    throw new Error("API configuration or session is missing.");
                }

                const response = await fetch(
                    `${apiUrl}/api/companies/${companyId}/customers/${selectedCustomerId}/addresses/`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        getErrorMessage(data, "Unable to load service addresses.")
                    );
                }

                if (active) {
                    const addressList: ServiceAddress[] = data;
                    setAddresses(addressList);

                    const primaryAddress = addressList.find(
                        (address) => address.is_primary
                    );

                    if (primaryAddress) {
                        setSelectedAddressId(primaryAddress.id);
                    }
                }
            } catch (err) {
                if (active) {
                    setAddressError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load service addresses."
                    );
                }
            } finally {
                if (active) setAddressesLoading(false);
            }
        }

        fetchAddresses();

        return () => {
            active = false;
        };
    }, [modalOpen, selectedCustomerId, companyId, apiUrl]);

    function openCreateModal() {
        setSelectedCustomerId("");
        setSelectedAddressId("");
        setAddresses([]);
        setTitle("");
        setDescription("");
        setPriority("MEDIUM");
        setTechnicianId("");
        setScheduledStart("");
        setScheduledEnd("");
        setCreateError("");
        setAddressError("");
        setModalOpen(true);
    }

    function closeCreateModal() {
        if (creating) return;
        setModalOpen(false);
    }

    async function handleCreateJob(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setCreateError("");

        if (!companyId || !apiUrl) {
            setCreateError("Company or API configuration is missing.");
            return;
        }

        if (!selectedCustomerId) {
            setCreateError("Please select a customer.");
            return;
        }

        if (!selectedAddressId) {
            setCreateError("Please select a service address.");
            return;
        }

        if (scheduledEnd && !scheduledStart) {
            setCreateError("Please select a scheduled start time.");
            return;
        }

        if (
            scheduledStart &&
            scheduledEnd &&
            new Date(scheduledEnd) <= new Date(scheduledStart)
        ) {
            setCreateError("Scheduled end must be after scheduled start.");
            return;
        }

        setCreating(true);

        try {
            const token = sessionStorage.getItem("accessToken");

            if (!token) {
                throw new Error("Your session has expired. Please log in again.");
            }

            const payload = {
                customer: selectedCustomerId,
                service_address: selectedAddressId,
                assigned_technician: technicianId || null,
                title: title.trim(),
                description: description.trim(),
                priority,
                scheduled_start: scheduledStart
                    ? new Date(scheduledStart).toISOString()
                    : null,
                scheduled_end: scheduledEnd
                    ? new Date(scheduledEnd).toISOString()
                    : null,
            };

            const response = await fetch(
                `${apiUrl}/api/companies/${companyId}/jobs/`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(data, "Unable to create service job.")
                );
            }

            const createdJob: ServiceJob = data;

            setJobs((previousJobs) => [
                createdJob,
                ...previousJobs.filter((job) => job.id !== createdJob.id),
            ]);

            setModalOpen(false);
        } catch (err) {
            setCreateError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong while creating the job."
            );
        } finally {
            setCreating(false);
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8">
                    <Link
                        href="/"
                        className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-blue-600 dark:text-slate-400"
                    >
                        ← Back to Dashboard
                    </Link>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                Service Jobs
                            </h1>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Manage and track your company's service jobs.
                            </p>
                        </div>

                        {canManageJobs && (
                            <button
                                onClick={openCreateModal}
                                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                                + Create Service Job
                            </button>
                        )}
                    </div>
                </div>

                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        { label: "Total Jobs", value: counts.total },
                        { label: "Active Jobs", value: counts.active },
                        { label: "In Progress", value: counts.inProgress },
                        { label: "Completed", value: counts.completed },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                        >
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {item.label}
                            </p>
                            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                                {loading ? "—" : item.value}
                            </p>
                        </div>
                    ))}
                </div>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
                        <div className="flex flex-col gap-3 lg:flex-row">
                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search jobs or customers..."
                                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />

                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            >
                                <option value="ALL">All statuses</option>
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                        {formatLabel(status)}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={priorityFilter}
                                onChange={(event) => setPriorityFilter(event.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            >
                                <option value="ALL">All priorities</option>
                                {PRIORITY_OPTIONS.map((priorityOption) => (
                                    <option key={priorityOption} value={priorityOption}>
                                        {formatLabel(priorityOption)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
                            Loading service jobs...
                        </div>
                    ) : error ? (
                        <div className="p-12 text-center">
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {error}
                            </p>
                        </div>
                    ) : filteredJobs.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-base font-semibold text-slate-900 dark:text-white">
                                {jobs.length === 0
                                    ? "No service jobs yet"
                                    : "No matching jobs found"}
                            </p>
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                {jobs.length === 0
                                    ? "Your service jobs will appear here once they are created."
                                    : "Try changing your search or filters."}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold">Job</th>
                                            <th className="px-6 py-4 font-semibold">Customer</th>
                                            <th className="px-6 py-4 font-semibold">Schedule</th>
                                            <th className="px-6 py-4 font-semibold">Priority</th>
                                            <th className="px-6 py-4 font-semibold">Status</th>
                                            <th className="px-6 py-4 font-semibold">Technician</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredJobs.map((job) => {
                                            const assignedTechnician = technicians.find(
                                                (technician) =>
                                                    technician.id === job.assigned_technician
                                            );

                                            return (
                                                <tr
                                                    key={job.id}
                                                    className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                                >
                                                    <td className="px-6 py-4">
                                                        <p className="font-semibold text-slate-900 dark:text-white">
                                                            {job.title}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            #{job.id.slice(0, 8)}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                                                        {customerNames.get(job.customer) || "Unknown customer"}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                                        {formatDate(job.scheduled_start)}
                                                    </td>
                                                    <td className={`px-6 py-4 text-sm font-semibold ${priorityClasses(job.priority)}`}>
                                                        {formatLabel(job.priority)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(job.status)}`}>
                                                            {formatLabel(job.status)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                                        {assignedTechnician?.name ||
                                                            (job.assigned_technician ? "Assigned" : "Unassigned")}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                                {filteredJobs.map((job) => (
                                    <div key={job.id} className="space-y-3 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-slate-900 dark:text-white">
                                                    {job.title}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    #{job.id.slice(0, 8)}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(job.status)}`}>
                                                {formatLabel(job.status)}
                                            </span>
                                        </div>

                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                            {customerNames.get(job.customer) || "Unknown customer"}
                                        </p>

                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                            <span className={priorityClasses(job.priority)}>
                                                {formatLabel(job.priority)} priority
                                            </span>
                                            <span className="text-slate-500 dark:text-slate-400">
                                                {formatDate(job.scheduled_start)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {!loading && !error && filteredJobs.length > 0 && (
                        <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            Showing {filteredJobs.length} of {jobs.length} jobs
                        </div>
                    )}
                </section>
            </div>

            {modalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeCreateModal();
                        }
                    }}
                >
                    <div className="my-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                    Create Service Job
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Add a new service job for your customer.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeCreateModal}
                                disabled={creating}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
                                aria-label="Close modal"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateJob}>
                            <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
                                {createError && (
                                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                                        {createError}
                                    </div>
                                )}

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Customer <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        required
                                        value={selectedCustomerId}
                                        onChange={(event) => {
                                            setSelectedCustomerId(event.target.value);
                                            setSelectedAddressId("");
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    >
                                        <option value="">Select a customer</option>
                                        {activeCustomers.map((customer) => (
                                            <option key={customer.id} value={customer.id}>
                                                {customer.name}
                                            </option>
                                        ))}
                                    </select>

                                    {activeCustomers.length === 0 && (
                                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                            No active customers found. Add or activate a customer before creating a job.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Service Address <span className="text-red-500">*</span>
                                    </label>

                                    <select
                                        required
                                        disabled={!selectedCustomerId || addressesLoading || addresses.length === 0}
                                        value={selectedAddressId}
                                        onChange={(event) => setSelectedAddressId(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    >
                                        <option value="">
                                            {!selectedCustomerId
                                                ? "Select a customer first"
                                                : addressesLoading
                                                    ? "Loading addresses..."
                                                    : "Select a service address"}
                                        </option>

                                        {addresses.map((address) => (
                                            <option key={address.id} value={address.id}>
                                                {address.label || "Service Address"}
                                                {address.is_primary ? " (Primary)" : ""} — {formatAddress(address)}
                                            </option>
                                        ))}
                                    </select>

                                    {addressError && (
                                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                                            {addressError}
                                        </p>
                                    )}

                                    {selectedCustomerId &&
                                        !addressesLoading &&
                                        !addressError &&
                                        addresses.length === 0 && (
                                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                                No service addresses found for this customer. Add an address before creating the job.
                                            </p>
                                        )}
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Job Title <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        maxLength={255}
                                        value={title}
                                        onChange={(event) => setTitle(event.target.value)}
                                        placeholder="e.g. AC not cooling"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Description
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={description}
                                        onChange={(event) => setDescription(event.target.value)}
                                        placeholder="Describe the reported issue or required service..."
                                        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            Priority
                                        </label>
                                        <select
                                            value={priority}
                                            onChange={(event) => setPriority(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                        >
                                            {PRIORITY_OPTIONS.map((option) => (
                                                <option key={option} value={option}>
                                                    {formatLabel(option)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            Assign Technician
                                        </label>
                                        <select
                                            value={technicianId}
                                            onChange={(event) => setTechnicianId(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                        >
                                            <option value="">Unassigned</option>
                                            {technicians.map((technician) => (
                                                <option key={technician.id} value={technician.id}>
                                                    {technician.name}
                                                </option>
                                            ))}
                                        </select>

                                        {technicians.length === 0 && (
                                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                No active technicians available. You can assign one later.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            Scheduled Start
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={scheduledStart}
                                            onChange={(event) => setScheduledStart(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            Scheduled End
                                        </label>
                                        <input
                                            type="datetime-local"
                                            min={scheduledStart || undefined}
                                            value={scheduledEnd}
                                            onChange={(event) => setScheduledEnd(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    New jobs are created with the New status. Scheduling and technician assignment are optional.
                                </p>
                            </div>

                            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={closeCreateModal}
                                    disabled={creating}
                                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={
                                        creating ||
                                        activeCustomers.length === 0 ||
                                        addresses.length === 0 ||
                                        addressesLoading
                                    }
                                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {creating ? "Creating Job..." : "Create Service Job"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}

export default function JobsPage() {
    return (
        <AuthGuard>
            <JobsContent />
        </AuthGuard>
    );
}
