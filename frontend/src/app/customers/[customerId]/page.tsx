"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "../../components/auth-guard";
import { useCurrentUser } from "../../components/current-user-provider";

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

interface CustomerAddress {
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
    created_at: string;
}

interface ServiceJob {
    id: string;
    customer: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    scheduled_start: string | null;
    completed_at?: string | null;
    created_at: string;
}

function formatDate(value: string | null) {
    if (!value) return "Not scheduled";

    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function formatLabel(value: string) {
    return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) =>
        char.toUpperCase()
    );
}

function getErrorMessage(data: unknown, fallback: string): string {
    if (typeof data === "string") return data;

    if (data && typeof data === "object") {
        const details = data as Record<string, unknown>;

        if (typeof details.detail === "string") return details.detail;
        if (typeof details.error === "string") return details.error;

        const firstError = Object.values(details).flat()[0];

        if (typeof firstError === "string") return firstError;
    }

    return fallback;
}

async function readResponse(response: Response) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
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

function CustomerDetailsContent() {
    const params = useParams<{ customerId: string }>();
    const customerId = params.customerId;

    const { user, loading: userLoading } = useCurrentUser();

    const companyId = user?.memberships?.[0]?.company_id;
    const role = user?.memberships?.[0]?.role;

    const canManage =
        role === "COMPANY_ADMIN" || role === "MANAGER";

    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
    const [jobs, setJobs] = useState<ServiceJob[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [customerActionLoading, setCustomerActionLoading] = useState(false);
    const [customerActionError, setCustomerActionError] = useState("");
    const [showDeactivateConfirmation, setShowDeactivateConfirmation] = useState(false);

    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState("");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");

    const [showAddressForm, setShowAddressForm] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [addressDeletingId, setAddressDeletingId] = useState<string | null>(null);
    const [addressPrimaryUpdatingId, setAddressPrimaryUpdatingId] = useState<string | null>(null);
    const [addressSaving, setAddressSaving] = useState(false);
    const [addressError, setAddressError] = useState("");

    const [addressLabel, setAddressLabel] = useState("Primary");
    const [addressLine1, setAddressLine1] = useState("");
    const [addressLine2, setAddressLine2] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [country, setCountry] = useState("India");
    const [isPrimary, setIsPrimary] = useState(false);

    const getHeaders = useCallback(() => {
        const token = sessionStorage.getItem("accessToken");

        if (!apiUrl || !token) {
            throw new Error("API configuration or session is missing.");
        }

        return {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };
    }, [apiUrl]);

    const fetchCustomerData = useCallback(async () => {
        if (!companyId || !customerId || !apiUrl) return;

        setLoading(true);
        setError("");

        try {
            const headers = getHeaders();

            const [customerResponse, addressResponse, jobsResponse] =
                await Promise.all([
                    fetch(
                        `${apiUrl}/api/companies/${companyId}/customers/${customerId}/`,
                        { headers }
                    ),
                    fetch(
                        `${apiUrl}/api/companies/${companyId}/customers/${customerId}/addresses/`,
                        { headers }
                    ),
                    fetch(
                        `${apiUrl}/api/companies/${companyId}/jobs/`,
                        { headers }
                    ),
                ]);

            const [customerData, addressData, jobsData] = await Promise.all([
                readResponse(customerResponse),
                readResponse(addressResponse),
                readResponse(jobsResponse),
            ]);

            if (!customerResponse.ok) {
                throw new Error(
                    getErrorMessage(customerData, "Unable to load customer.")
                );
            }

            if (!addressResponse.ok) {
                throw new Error(
                    getErrorMessage(addressData, "Unable to load addresses.")
                );
            }

            if (!jobsResponse.ok) {
                throw new Error(
                    getErrorMessage(jobsData, "Unable to load service history.")
                );
            }

            setCustomer(customerData);
            setName(customerData.name || "");
            setEmail(customerData.email || "");
            setPhone(customerData.phone || "");
            setNotes(customerData.notes || "");

            setAddresses(
                Array.isArray(addressData)
                    ? addressData
                    : addressData?.results || []
            );

            const allJobs: ServiceJob[] = Array.isArray(jobsData)
                ? jobsData
                : jobsData?.results || [];

            setJobs(
                allJobs
                    .filter((job) => job.customer === customerId)
                    .sort(
                        (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime()
                    )
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong."
            );
        } finally {
            setLoading(false);
        }
    }, [companyId, customerId, apiUrl, getHeaders]);

    useEffect(() => {
        if (userLoading) return;

        if (!companyId) {
            setError("No active company membership was found.");
            setLoading(false);
            return;
        }

        fetchCustomerData();
    }, [userLoading, companyId, fetchCustomerData]);

    async function updateCustomer(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!customer || !companyId || !apiUrl) return;

        setSaving(true);
        setEditError("");

        try {
            const response = await fetch(
                `${apiUrl}/api/companies/${companyId}/customers/${customerId}/`,
                {
                    method: "PATCH",
                    headers: getHeaders(),
                    body: JSON.stringify({
                        name: name.trim(),
                        email: email.trim(),
                        phone: phone.trim(),
                        notes: notes.trim(),
                    }),
                }
            );

            const data = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(data, "Unable to update customer.")
                );
            }

            setCustomer(data);
            setEditing(false);
        } catch (err) {
            setEditError(
                err instanceof Error ? err.message : "Update failed."
            );
        } finally {
            setSaving(false);
        }
    }

    async function handleCustomerStatusChange() {
        if (!customer || !companyId || !apiUrl) return;

        setCustomerActionLoading(true);
        setCustomerActionError("");

        const isReactivating = !customer.is_active;

        try {
            const url = isReactivating
                ? `${apiUrl}/api/companies/${companyId}/customers/${customerId}/reactivate/`
                : `${apiUrl}/api/companies/${companyId}/customers/${customerId}/`;

            const response = await fetch(url, {
                method: isReactivating ? "POST" : "DELETE",
                headers: getHeaders(),
            });

            const data = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(
                        data,
                        isReactivating
                            ? "Unable to reactivate customer."
                            : "Unable to deactivate customer."
                    )
                );
            }

            if (isReactivating) {
                setCustomer(data);
            } else {
                setCustomer((previous) =>
                    previous ? { ...previous, is_active: false } : previous
                );
            }

            setEditing(false);
            setShowDeactivateConfirmation(false);
        } catch (err) {
            setCustomerActionError(
                err instanceof Error
                    ? err.message
                    : "Unable to update customer status."
            );
        } finally {
            setCustomerActionLoading(false);
        }
    }

    async function addAddress(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!companyId || !apiUrl) return;

        setAddressSaving(true);
        setAddressError("");

        try {
            const isEditing = Boolean(editingAddressId);

            const url = isEditing
                ? `${apiUrl}/api/companies/${companyId}/customers/${customerId}/addresses/${editingAddressId}/`
                : `${apiUrl}/api/companies/${companyId}/customers/${customerId}/addresses/`;

            const response = await fetch(url, {
                method: isEditing ? "PATCH" : "POST",
                headers: getHeaders(),
                body: JSON.stringify({
                    label: addressLabel.trim(),
                    address_line_1: addressLine1.trim(),
                    address_line_2: addressLine2.trim(),
                    city: city.trim(),
                    state: state.trim(),
                    postal_code: postalCode.trim(),
                    country: country.trim(),
                    is_primary: isPrimary || addresses.length === 0,
                }),
            });

            const data = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(data, "Unable to save service address.")
                );
            }

            setAddresses((previous) => {
                const updated = previous
                    .filter((address) => address.id !== data.id)
                    .map((address) =>
                        data.is_primary
                            ? { ...address, is_primary: false }
                            : address
                    );

                return [data, ...updated];
            });

            resetAddressForm();
        } catch (err) {
            setAddressError(
                err instanceof Error ? err.message : "Unable to save address."
            );
        } finally {
            setAddressSaving(false);
        }
    }

    function startEditingAddress(address: CustomerAddress) {
        setEditingAddressId(address.id);
        setAddressLabel(address.label);
        setAddressLine1(address.address_line_1);
        setAddressLine2(address.address_line_2 || "");
        setCity(address.city);
        setState(address.state);
        setPostalCode(address.postal_code);
        setCountry(address.country);
        setIsPrimary(address.is_primary);
        setAddressError("");
        setShowAddressForm(true);
    }

    function resetAddressForm() {
        setEditingAddressId(null);
        setAddressLabel("Primary");
        setAddressLine1("");
        setAddressLine2("");
        setCity("");
        setState("");
        setPostalCode("");
        setCountry("India");
        setIsPrimary(false);
        setAddressError("");
        setShowAddressForm(false);
    }

    async function deleteAddress(address: CustomerAddress) {
        if (!companyId || !apiUrl) return;

        const confirmed = window.confirm(
            `Delete the "${address.label}" address? This action cannot be undone.`
        );

        if (!confirmed) return;

        setAddressDeletingId(address.id);
        setAddressError("");

        try {
            const response = await fetch(
                `${apiUrl}/api/companies/${companyId}/customers/${customerId}/addresses/${address.id}/`,
                {
                    method: "DELETE",
                    headers: getHeaders(),
                }
            );

            if (!response.ok) {
                const data = await readResponse(response);
                throw new Error(
                    getErrorMessage(data, "Unable to delete address.")
                );
            }

            setAddresses((previous) =>
                previous.filter((item) => item.id !== address.id)
            );

            if (editingAddressId === address.id) {
                resetAddressForm();
            }
        } catch (err) {
            setAddressError(
                err instanceof Error ? err.message : "Unable to delete address."
            );
        } finally {
            setAddressDeletingId(null);
        }
    }

    async function makePrimaryAddress(address: CustomerAddress) {
        if (!companyId || !apiUrl || address.is_primary) return;

        setAddressPrimaryUpdatingId(address.id);
        setAddressError("");

        try {
            const response = await fetch(
                `${apiUrl}/api/companies/${companyId}/customers/${customerId}/addresses/${address.id}/`,
                {
                    method: "PATCH",
                    headers: getHeaders(),
                    body: JSON.stringify({
                        is_primary: true,
                    }),
                }
            );

            const data = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(data, "Unable to update primary address.")
                );
            }

            setAddresses((previous) =>
                previous.map((item) => ({
                    ...item,
                    is_primary: item.id === address.id,
                }))
            );
        } catch (err) {
            setAddressError(
                err instanceof Error
                    ? err.message
                    : "Unable to update primary address."
            );
        } finally {
            setAddressPrimaryUpdatingId(null);
        }
    }

    if (userLoading || loading) {
        return (
            <main className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
                <div className="mx-auto max-w-7xl animate-pulse space-y-5">
                    <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-40 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                    <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                </div>
            </main>
        );
    }

    if (error || !customer) {
        return (
            <main className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
                <div className="mx-auto max-w-4xl">
                    <Link
                        href="/customers"
                        className="text-sm font-medium text-blue-600 hover:underline"
                    >
                        ← Back to Customers
                    </Link>

                    <div className="mt-6 rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-600 dark:border-red-900 dark:bg-slate-900 dark:text-red-400">
                        {error || "Customer not found."}
                        <button
                            onClick={fetchCustomerData}
                            className="ml-3 font-semibold underline"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-6">

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Link
                            href="/customers"
                            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                            ← Back to Customers
                        </Link>

                        <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                            Customer Details
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            View customer information, service addresses and job history.
                        </p>
                    </div>

                    {canManage && !editing && (
                        <div className="flex flex-wrap gap-3">
                            {customer.is_active && (
                                <>
                                    <button
                                        onClick={() => setEditing(true)}
                                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                                    >
                                        Edit Customer
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCustomerActionError("");
                                            setShowDeactivateConfirmation(true);
                                        }}
                                        className="rounded-xl border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                                    >
                                        Deactivate Customer
                                    </button>
                                </>
                            )}

                            {!customer.is_active && (
                                <button
                                    onClick={handleCustomerStatusChange}
                                    disabled={customerActionLoading}
                                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {customerActionLoading ? "Reactivating..." : "Reactivate Customer"}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {customerActionError && (
                    <p className="rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {customerActionError}
                    </p>
                )}

                {showDeactivateConfirmation && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/20">
                        <h3 className="font-semibold text-red-800 dark:text-red-300">
                            Deactivate {customer.name}?
                        </h3>

                        <p className="mt-2 text-sm text-red-700 dark:text-red-400">
                            This customer will no longer appear in the active customer
                            directory or be available for new service jobs. Existing service
                            history and addresses will be preserved. You can reactivate
                            this customer later.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3">
                            <button
                                onClick={() => setShowDeactivateConfirmation(false)}
                                disabled={customerActionLoading}
                                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleCustomerStatusChange}
                                disabled={customerActionLoading}
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {customerActionLoading ? "Deactivating..." : "Confirm Deactivation"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Customer profile */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    {!editing ? (
                        <>
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-xl font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                            {customer.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                                {customer.name}
                                            </h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Customer since {formatDate(customer.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${customer.is_active
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    }`}>
                                    {customer.is_active ? "Active" : "Inactive"}
                                </span>
                            </div>

                            <div className="mt-7 grid gap-6 border-t border-slate-100 pt-6 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-3">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                        Email
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                                        {customer.email || "Not provided"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                        Phone
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                                        {customer.phone || "Not provided"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                        Customer ID
                                    </p>
                                    <p className="mt-2 break-all font-mono text-xs text-slate-500">
                                        {customer.id}
                                    </p>
                                </div>
                            </div>

                            {customer.notes && (
                                <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                        Notes
                                    </p>
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                                        {customer.notes}
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        <form onSubmit={updateCustomer} className="space-y-5">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                Edit Customer Information
                            </h2>

                            {editError && (
                                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                    {editError}
                                </p>
                            )}

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Customer Name
                                    </label>
                                    <input
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Phone
                                    </label>
                                    <input
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Notes
                                </label>
                                <textarea
                                    rows={3}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                />
                            </div>

                            <div className="flex flex-wrap justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditing(false);
                                        setName(customer.name);
                                        setEmail(customer.email);
                                        setPhone(customer.phone);
                                        setNotes(customer.notes);
                                        setEditError("");
                                    }}
                                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                >
                                    Cancel
                                </button>

                                <button
                                    disabled={saving}
                                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    )}
                </section>

                {/* Service addresses */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                Service Addresses
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Saved locations for this customer.
                            </p>
                        </div>

                        {canManage && (
                            <button
                                onClick={() => {
                                    if (showAddressForm) {
                                        resetAddressForm();
                                    } else {
                                        setEditingAddressId(null);
                                        setAddressLabel("Primary");
                                        setAddressLine1("");
                                        setAddressLine2("");
                                        setCity("");
                                        setState("");
                                        setPostalCode("");
                                        setCountry("India");
                                        setIsPrimary(false);
                                        setAddressError("");
                                        setShowAddressForm(true);
                                    }
                                }}
                                className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-900/20"
                            >
                                {showAddressForm ? "Close Form" : "+ Add Address"}
                            </button>
                        )}
                    </div>

                    {showAddressForm && canManage && (
                        <form
                            onSubmit={addAddress}
                            className="mt-6 space-y-4 rounded-xl border border-slate-200 p-5 dark:border-slate-700"
                        >
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                {editingAddressId ? "Edit Service Address" : "New Service Address"}
                            </h3>

                            {addressError && (
                                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                    {addressError}
                                </p>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Address Label
                                    </label>
                                    <input
                                        required
                                        value={addressLabel}
                                        onChange={(e) => setAddressLabel(e.target.value)}
                                        placeholder="Home, Office, Branch..."
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Address Line 1
                                    </label>
                                    <input
                                        required
                                        value={addressLine1}
                                        onChange={(e) => setAddressLine1(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Address Line 2
                                    </label>
                                    <input
                                        value={addressLine2}
                                        onChange={(e) => setAddressLine2(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        City
                                    </label>
                                    <input
                                        required
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        State
                                    </label>
                                    <input
                                        required
                                        value={state}
                                        onChange={(e) => setState(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Postal Code
                                    </label>
                                    <input
                                        required
                                        value={postalCode}
                                        onChange={(e) => setPostalCode(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Country
                                    </label>
                                    <input
                                        required
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={resetAddressForm}
                                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                >
                                    Cancel
                                </button>

                                <button
                                    disabled={addressSaving}
                                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {addressSaving
                                        ? "Saving..."
                                        : editingAddressId
                                            ? "Update Address"
                                            : "Save Address"}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="mt-5 space-y-3">
                        {addresses.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                                <p className="font-medium text-slate-700 dark:text-slate-300">
                                    No service addresses yet
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    Add an address to use when creating service jobs.
                                </p>
                            </div>
                        ) : (
                            addresses.map((address) => (
                                <div
                                    key={address.id}
                                    className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                                {address.label}
                                            </h3>

                                            {address.is_primary && (
                                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                    Primary
                                                </span>
                                            )}
                                        </div>

                                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                            {[
                                                address.address_line_1,
                                                address.address_line_2,
                                                address.city,
                                                address.state,
                                                address.postal_code,
                                                address.country,
                                            ]
                                                .filter(Boolean)
                                                .join(", ")}
                                        </p>
                                    </div>

                                    {canManage && (
                                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                                            {!address.is_primary && (
                                                <button
                                                    type="button"
                                                    onClick={() => makePrimaryAddress(address)}
                                                    disabled={addressPrimaryUpdatingId !== null}
                                                    className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                                >
                                                    {addressPrimaryUpdatingId === address.id
                                                        ? "Updating..."
                                                        : "Make Primary"}
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => startEditingAddress(address)}
                                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                disabled={addressDeletingId === address.id}
                                                onClick={() => deleteAddress(address)}
                                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
                                            >
                                                {addressDeletingId === address.id
                                                    ? "Deleting..."
                                                    : "Delete"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Service job history */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                Service History
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Previous and ongoing service jobs for this customer.
                            </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {jobs.length} {jobs.length === 1 ? "Job" : "Jobs"}
                        </span>
                    </div>

                    <div className="mt-5 space-y-3">
                        {jobs.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                                <p className="font-medium text-slate-700 dark:text-slate-300">
                                    No service history yet
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    Jobs created for this customer will appear here.
                                </p>
                            </div>
                        ) : (
                            jobs.map((job) => (
                                <Link
                                    key={job.id}
                                    href={`/jobs/${job.id}`}
                                    className="block rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-blue-800 dark:hover:bg-slate-800/50"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                                {job.title}
                                            </h3>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                Created {formatDate(job.created_at)}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(job.status)}`}>
                                                {formatLabel(job.status)}
                                            </span>
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                {formatLabel(job.priority)}
                                            </span>
                                        </div>
                                    </div>

                                    {job.description && (
                                        <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                                            {job.description}
                                        </p>
                                    )}

                                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                        Scheduled: {formatDate(job.scheduled_start)}
                                    </p>
                                </Link>
                            ))
                        )}
                    </div>
                </section>

            </div>
        </main>
    );
}

export default function CustomerDetailsPage() {
    return (
        <AuthGuard>
            <CustomerDetailsContent />
        </AuthGuard>
    );
}
