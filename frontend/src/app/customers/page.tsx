"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "../components/auth-guard";
import { useCurrentUser } from "../components/current-user-provider";

interface Customer {
    id: string;
    name: string;
    email: string;
    phone: string;
    notes: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
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

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

function CustomersContent() {
    const { user, loading: userLoading } = useCurrentUser();

    const companyId = user?.memberships?.[0]?.company_id;
    const role = user?.memberships?.[0]?.role;

    const canManageCustomers =
        role === "COMPANY_ADMIN" || role === "MANAGER";

    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");

    const [showInactive, setShowInactive] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");

    const fetchCustomers = useCallback(async () => {
        if (!companyId || !apiUrl) return;

        setLoading(true);
        setError("");

        try {
            const token = sessionStorage.getItem("accessToken");

            if (!token) {
                throw new Error(
                    "Your session has expired. Please log in again."
                );
            }

            const response = await fetch(
                `${apiUrl}/api/companies/${companyId}/customers/${showInactive ? "?include_inactive=true" : ""
                }`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(data, "Unable to load customers.")
                );
            }

            const customerList: Customer[] = Array.isArray(data)
                ? data
                : data.results || [];

            setCustomers(customerList);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load customers."
            );
        } finally {
            setLoading(false);
        }
    }, [companyId, apiUrl, showInactive]);

    useEffect(() => {
        if (userLoading) return;

        if (!companyId) {
            setError("No active company membership was found.");
            setLoading(false);
            return;
        }

        fetchCustomers();
    }, [userLoading, companyId, fetchCustomers]);

    const filteredCustomers = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) return customers;

        return customers.filter((customer) =>
            [
                customer.name,
                customer.email,
                customer.phone,
            ].some((value) =>
                value.toLowerCase().includes(query)
            )
        );
    }, [customers, search]);

    function resetForm() {
        setName("");
        setEmail("");
        setPhone("");
        setNotes("");
        setCreateError("");
    }

    async function handleCreateCustomer(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (!companyId || !apiUrl) {
            setCreateError("Company or API configuration is missing.");
            return;
        }

        setCreating(true);
        setCreateError("");

        try {
            const token = sessionStorage.getItem("accessToken");

            if (!token) {
                throw new Error(
                    "Your session has expired. Please log in again."
                );
            }

            const response = await fetch(
                `${apiUrl}/api/companies/${companyId}/customers/`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: name.trim(),
                        email: email.trim(),
                        phone: phone.trim(),
                        notes: notes.trim(),
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(data, "Unable to create customer.")
                );
            }

            setCustomers((previous) => [
                data as Customer,
                ...previous.filter(
                    (customer) => customer.id !== data.id
                ),
            ]);

            setModalOpen(false);
            resetForm();
        } catch (err) {
            setCreateError(
                err instanceof Error
                    ? err.message
                    : "Unable to create customer."
            );
        } finally {
            setCreating(false);
        }
    }

    const totalCustomers = customers.length;

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl">

                <Link
                    href="/"
                    className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-blue-600 dark:text-slate-400"
                >
                    ← Back to Dashboard
                </Link>

                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Customers
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Manage your customers and their contact information.
                        </p>
                    </div>

                    {canManageCustomers && (
                        <button
                            type="button"
                            onClick={() => {
                                resetForm();
                                setModalOpen(true);
                            }}
                            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                            + Add Customer
                        </button>
                    )}
                </div>

                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Total Customers
                        </p>
                        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                            {loading ? "—" : totalCustomers}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                            Active customer records
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Search Results
                        </p>
                        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                            {loading ? "—" : filteredCustomers.length}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                            Customers matching your search
                        </p>
                    </div>
                </div>

                <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="relative flex-1">
                            <input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search by name, email or phone..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={fetchCustomers}
                            disabled={loading}
                            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            ↻ Refresh
                        </button>
                        {canManageCustomers && (
                            <button
                                type="button"
                                onClick={() => setShowInactive((previous) => !previous)}
                                className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${showInactive
                                    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    }`}
                            >
                                {showInactive ? "Show Active Only" : "Include Inactive"}
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                        <p>{error}</p>
                        <button
                            type="button"
                            onClick={fetchCustomers}
                            className="mt-2 font-semibold underline"
                        >
                            Try again
                        </button>
                    </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                        <h2 className="font-semibold text-slate-900 dark:text-white">
                            Customer Directory
                        </h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {filteredCustomers.length} customer{filteredCustomers.length === 1 ? "" : "s"}
                        </p>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
                            Loading customers...
                        </div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="mb-3 text-4xl">♙</div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                {search ? "No matching customers" : "No customers yet"}
                            </h3>
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                {search
                                    ? "Try another search term."
                                    : "Add your first customer to get started."}
                            </p>
                            {!search && canManageCustomers && (
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(true)}
                                    className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                                >
                                    Add Customer
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                                        <tr>
                                            <th className="px-5 py-4 font-semibold">Customer</th>
                                            <th className="px-5 py-4 font-semibold">Email</th>
                                            <th className="px-5 py-4 font-semibold">Phone</th>
                                            <th className="px-5 py-4 font-semibold">Status</th>
                                            <th className="px-5 py-4 font-semibold">Added</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredCustomers.map((customer) => (
                                            <tr
                                                key={customer.id}
                                                className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            >
                                                <td className="px-5 py-4">
                                                    <Link
                                                        href={`/customers/${customer.id}`}
                                                        className="font-medium text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                                                    >
                                                        {customer.name}
                                                    </Link>
                                                    <p className="mt-1 text-xs text-slate-400">
                                                        Customer
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                                                    {customer.email || "—"}
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                                                    {customer.phone || "—"}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${customer.is_active
                                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                            }`}
                                                    >
                                                        {customer.is_active ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                                                    {formatDate(customer.created_at)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                                {filteredCustomers.map((customer) => (
                                    <div key={customer.id} className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <Link
                                                    href={`/customers/${customer.id}`}
                                                    className="truncate font-semibold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                                                >
                                                    {customer.name}
                                                </Link>
                                                <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">
                                                    {customer.email || "No email"}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                    {customer.phone || "No phone"}
                                                </p>
                                            </div>
                                            <span
                                                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${customer.is_active
                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                    }`}
                                            >
                                                {customer.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-400">
                                            Added {formatDate(customer.created_at)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
                    <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <div className="mb-6 flex items-start justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                    Add Customer
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Enter the customer's contact information.
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={creating}
                                onClick={() => setModalOpen(false)}
                                className="rounded-lg px-3 py-1 text-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleCreateCustomer} className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Customer Name *
                                </label>
                                <input
                                    required
                                    maxLength={200}
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    placeholder="Enter customer name"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    maxLength={254}
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="customer@example.com"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    maxLength={20}
                                    value={phone}
                                    onChange={(event) => setPhone(event.target.value)}
                                    placeholder="Enter phone number"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Notes
                                </label>
                                <textarea
                                    rows={3}
                                    maxLength={2000}
                                    value={notes}
                                    onChange={(event) => setNotes(event.target.value)}
                                    placeholder="Additional customer information..."
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                />
                            </div>

                            {createError && (
                                <p className="text-sm text-red-600 dark:text-red-400">
                                    {createError}
                                </p>
                            )}

                            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    disabled={creating}
                                    onClick={() => setModalOpen(false)}
                                    className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating || !name.trim()}
                                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {creating ? "Creating..." : "Create Customer"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}

export default function CustomersPage() {
    return (
        <AuthGuard>
            <CustomersContent />
        </AuthGuard>
    );
}
