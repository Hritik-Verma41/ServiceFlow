"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AuthGuard } from "../components/auth-guard";
import { useCurrentUser } from "../components/current-user-provider";

interface TeamMember {
    id: string;
    user: {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        phone: string | null;
    };
    role: string;
    status: string;
    created_at: string;
    updated_at: string;
}

interface InvitationResponse {
    id: string;
    email: string;
    role: string;
    status: string;
}

function formatRole(role: string) {
    return role
        .split("_")
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(" ");
}

function getInitials(member: TeamMember) {
    const name = `${member.user.first_name} ${member.user.last_name}`.trim();

    if (!name) return member.user.email.charAt(0).toUpperCase();

    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");
}

function getMemberName(member: TeamMember) {
    const name = `${member.user.first_name} ${member.user.last_name}`.trim();
    return name || member.user.email;
}

function TeamContent() {
    const { user, loading: userLoading } = useCurrentUser();

    const companyId = user?.memberships?.[0]?.company_id;
    const currentRole = user?.memberships?.[0]?.role;

    const canInvite =
        currentRole === "COMPANY_ADMIN" || currentRole === "MANAGER";

    const availableInviteRoles =
        currentRole === "COMPANY_ADMIN"
            ? [
                  { value: "MANAGER", label: "Manager" },
                  { value: "TECHNICIAN", label: "Technician" },
                  { value: "COMPANY_ADMIN", label: "Company Admin" },
              ]
            : [{ value: "TECHNICIAN", label: "Technician" }];

    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");

    // Invitation state
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("TECHNICIAN");
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Fetch company members
    useEffect(() => {
        if (userLoading) return;

        if (!companyId) {
            setError("No active company membership was found.");
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        async function fetchMembers() {
            try {
                setLoading(true);
                setError("");

                const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
                const token = sessionStorage.getItem("accessToken");

                if (!apiUrl || !token) {
                    throw new Error("API configuration or session is missing.");
                }

                const response = await fetch(
                    `${apiUrl}/api/companies/${companyId}/members/`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        signal: controller.signal,
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        response.status === 403
                            ? "You don't have permission to view this team."
                            : "Unable to load team members."
                    );
                }

                const data: TeamMember[] = await response.json();
                setMembers(data);
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") {
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load team members."
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        fetchMembers();

        return () => controller.abort();
    }, [companyId, userLoading]);

    // Send invitation
    async function handleInviteMember(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!companyId) return;

        try {
            setInviting(true);
            setInviteError("");
            setSuccessMessage("");

            const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
            const token = sessionStorage.getItem("accessToken");

            if (!apiUrl || !token) {
                throw new Error("API configuration or session is missing.");
            }

            const response = await fetch(
                `${apiUrl}/api/accounts/companies/${companyId}/invitations/`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: inviteEmail.trim(),
                        role: inviteRole,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                const message =
                    typeof data.detail === "string"
                        ? data.detail
                        : typeof data.email === "string"
                          ? data.email
                          : typeof data.role === "string"
                            ? data.role
                            : "Unable to send the invitation.";

                throw new Error(message);
            }

            const invitation = data as InvitationResponse;

            setSuccessMessage(
                `Invitation sent successfully to ${invitation.email}.`
            );

            setInviteEmail("");
            setInviteRole("TECHNICIAN");
            setShowInviteModal(false);
        } catch (err) {
            setInviteError(
                err instanceof Error
                    ? err.message
                    : "Unable to send the invitation."
            );
        } finally {
            setInviting(false);
        }
    }

    // Filter members
    const filteredMembers = useMemo(() => {
        return members.filter((member) => {
            const name = getMemberName(member).toLowerCase();
            const email = member.user.email.toLowerCase();
            const query = search.toLowerCase().trim();

            const matchesSearch =
                !query || name.includes(query) || email.includes(query);

            const matchesRole =
                roleFilter === "ALL" || member.role === roleFilter;

            const matchesStatus =
                statusFilter === "ALL" || member.status === statusFilter;

            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [members, search, roleFilter, statusFilter]);

    const activeCount = members.filter(
        (member) => member.status === "ACTIVE"
    ).length;

    const technicianCount = members.filter(
        (member) => member.role === "TECHNICIAN"
    ).length;

    const managerCount = members.filter(
        (member) => member.role === "MANAGER"
    ).length;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            {/* Header */}
            <header className="border-b border-slate-200 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-900 sm:px-8">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Workspace / Team
                        </p>

                        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                            Team Management
                        </h1>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            View and manage your company members.
                        </p>
                    </div>

                    <a
                        href="/"
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        Back to Dashboard
                    </a>
                </div>
            </header>

            <main className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8">
                {/* Success notification */}
                {successMessage && (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <span>{successMessage}</span>

                        <button
                            onClick={() => setSuccessMessage("")}
                            className="ml-3 font-medium"
                            aria-label="Dismiss notification"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Summary cards */}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Total Members
                        </p>

                        <p className="mt-2 text-3xl font-semibold">
                            {loading ? "—" : members.length}
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Active Members
                        </p>

                        <p className="mt-2 text-3xl font-semibold text-emerald-600">
                            {loading ? "—" : activeCount}
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Technicians
                        </p>

                        <p className="mt-2 text-3xl font-semibold">
                            {loading ? "—" : technicianCount}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                            {loading ? "" : `${managerCount} managers`}
                        </p>
                    </div>
                </section>

                {/* Members section */}
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    {/* Section header and actions */}
                    <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-semibold">
                                Company Members
                            </h2>

                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {filteredMembers.length} of {members.length} members
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                            <input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search name or email..."
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 sm:w-64"
                            />

                            {canInvite && (
                                <button
                                    onClick={() => {
                                        setInviteError("");
                                        setShowInviteModal(true);
                                    }}
                                    className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                                >
                                    + Invite Member
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                        <select
                            value={roleFilter}
                            onChange={(event) =>
                                setRoleFilter(event.target.value)
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                        >
                            <option value="ALL">All roles</option>
                            <option value="COMPANY_ADMIN">Company Admin</option>
                            <option value="MANAGER">Manager</option>
                            <option value="TECHNICIAN">Technician</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(event.target.value)
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                        >
                            <option value="ALL">All statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="SUSPENDED">Suspended</option>
                            <option value="INVITED">Invited</option>
                        </select>
                    </div>

                    {/* Loading state */}
                    {loading && (
                        <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                            Loading team members...
                        </div>
                    )}

                    {/* Error state */}
                    {!loading && error && (
                        <div className="flex h-48 flex-col items-center justify-center gap-2 px-5 text-center">
                            <p className="text-sm font-medium text-red-500">
                                {error}
                            </p>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !error && filteredMembers.length === 0 && (
                        <div className="flex h-48 flex-col items-center justify-center gap-2 px-5 text-center">
                            <p className="font-medium">No members found</p>

                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Try changing your search or filters.
                            </p>
                        </div>
                    )}

                    {/* Members table */}
                    {!loading && !error && filteredMembers.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[680px] text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                                    <tr>
                                        <th className="px-5 py-4 font-medium">
                                            Member
                                        </th>

                                        <th className="px-5 py-4 font-medium">
                                            Role
                                        </th>

                                        <th className="px-5 py-4 font-medium">
                                            Phone
                                        </th>

                                        <th className="px-5 py-4 font-medium">
                                            Status
                                        </th>

                                        <th className="px-5 py-4 font-medium">
                                            Joined
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredMembers.map((member) => (
                                        <tr
                                            key={member.id}
                                            className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                        {getInitials(member)}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium">
                                                            {getMemberName(member)}
                                                        </p>

                                                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                                            {member.user.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-5 py-4">
                                                {formatRole(member.role)}
                                            </td>

                                            <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                                                {member.user.phone || "—"}
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                                        member.status === "ACTIVE"
                                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                                                            : member.status === "SUSPENDED"
                                                              ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                                                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                                                    }`}
                                                >
                                                    {member.status.charAt(0) +
                                                        member.status
                                                            .slice(1)
                                                            .toLowerCase()}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                                                {new Date(
                                                    member.created_at
                                                ).toLocaleDateString("en-IN", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>

            {/* Invite member modal */}
            {showInviteModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => {
                        if (!inviting) setShowInviteModal(false);
                    }}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-6 flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    Invite a team member
                                </h2>

                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Send an invitation to join your company.
                                </p>
                            </div>

                            <button
                                onClick={() => setShowInviteModal(false)}
                                disabled={inviting}
                                className="text-slate-400 hover:text-slate-700 disabled:opacity-50 dark:hover:text-white"
                                aria-label="Close invitation modal"
                            >
                                ✕
                            </button>
                        </div>

                        <form
                            onSubmit={handleInviteMember}
                            className="space-y-4"
                        >
                            <div>
                                <label
                                    htmlFor="invite-email"
                                    className="mb-2 block text-sm font-medium"
                                >
                                    Email address
                                </label>

                                <input
                                    id="invite-email"
                                    type="email"
                                    required
                                    value={inviteEmail}
                                    onChange={(event) =>
                                        setInviteEmail(event.target.value)
                                    }
                                    placeholder="colleague@example.com"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="invite-role"
                                    className="mb-2 block text-sm font-medium"
                                >
                                    Team role
                                </label>

                                <select
                                    id="invite-role"
                                    value={inviteRole}
                                    onChange={(event) =>
                                        setInviteRole(event.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                                >
                                    {availableInviteRoles.map((role) => (
                                        <option
                                            key={role.value}
                                            value={role.value}
                                        >
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {inviteError && (
                                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
                                    {inviteError}
                                </p>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    disabled={inviting}
                                    onClick={() =>
                                        setShowInviteModal(false)
                                    }
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={inviting}
                                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {inviting
                                        ? "Sending..."
                                        : "Send Invitation"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TeamPage() {
    return (
        <AuthGuard>
            <TeamContent />
        </AuthGuard>
    );
}
