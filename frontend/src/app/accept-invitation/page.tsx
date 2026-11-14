"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "../components/theme-toggle";

type PageMode = "loading" | "create" | "signin" | "success" | "error";

interface ApiError {
    detail?: string;
    [key: string]: unknown;
}

export default function AcceptInvitationPage() {
    const router = useRouter();

    const [mode, setMode] = useState<PageMode>("loading");
    const [token, setToken] = useState("");

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const invitationToken = new URLSearchParams(
            window.location.search
        ).get("token");

        if (!invitationToken) {
            setMode("error");
            setError(
                "This invitation link is missing its token. Please use the link from your invitation email."
            );
            return;
        }

        setToken(invitationToken);
        setMode("create");
    }, []);

    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    const inputClass =
        "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 caret-blue-600 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-900";

    const labelClass =
        "mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300";

    function getErrorMessage(data: ApiError, fallback: string) {
        if (typeof data.detail === "string") {
            return data.detail;
        }

        return fallback;
    }

    async function acceptInvitation(
        accessToken?: string,
        accountDetails?: {
            password: string;
            first_name: string;
            last_name: string;
        }
    ) {
        if (!apiUrl) {
            throw new Error("API URL is not configured.");
        }

        const headers: HeadersInit = {
            "Content-Type": "application/json",
        };

        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }

        const response = await fetch(
            `${apiUrl}/api/accounts/invitations/accept/`,
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    token,
                    ...(accountDetails || {}),
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                setMode("signin");

                setError(
                    response.status === 403
                        ? "This invitation belongs to a different email address. Please sign in using the account that received the invitation."
                        : "Please sign in with the account that received this invitation."
                );

                return false;
            }

            throw new Error(
                getErrorMessage(
                    data,
                    "Unable to accept this invitation. The link may have expired."
                )
            );
        }

        return true;
    }

    async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setLoading(true);
        setError("");

        try {
            if (!apiUrl) {
                throw new Error("API URL is not configured.");
            }

            const accepted = await acceptInvitation(undefined, {
                password,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
            });

            if (accepted) {
                setMode("success");
                setPassword("");
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to create your account. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleExistingAccount(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setLoading(true);
        setError("");

        try {
            if (!apiUrl) {
                throw new Error("API URL is not configured.");
            }

            // Authenticate using the invited account.
            const loginResponse = await fetch(
                `${apiUrl}/api/auth/token/`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: email.trim(),
                        password,
                    }),
                }
            );

            const loginData = await loginResponse.json();

            if (!loginResponse.ok) {
                throw new Error(
                    getErrorMessage(
                        loginData,
                        "Invalid email or password."
                    )
                );
            }

            if (!loginData.access || !loginData.refresh) {
                throw new Error(
                    "Invalid authentication response from server."
                );
            }

            // Accept the invitation using the authenticated account.
            const accepted = await acceptInvitation(loginData.access);

            if (!accepted) {
                return;
            }

            sessionStorage.setItem("accessToken", loginData.access);
            sessionStorage.setItem("refreshToken", loginData.refresh);

            router.replace("/");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to sign in and accept the invitation."
            );
        } finally {
            setLoading(false);
        }
    }

    function renderPasswordToggle() {
        return (
            <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-3 flex items-center text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
            >
                {showPassword ? (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 9 4 10 7a11.8 11.8 0 0 1-3 4.5" />
                        <path d="M6.6 6.6C4.2 8 2 10 2 12c1 3 5 7 10 7 1.2 0 2.3-.2 3.3-.6" />
                    </svg>
                ) : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                )}
            </button>
        );
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 transition-colors dark:bg-slate-950">
            {/* Theme Toggle */}
            <div className="absolute right-6 top-6 z-10">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-md">
                {/* ServiceFlow Branding */}
                <div className="mb-8 flex justify-center">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm">
                            <Image
                                src="/serviceflow-icon.png"
                                alt="ServiceFlow"
                                width={44}
                                height={44}
                                priority
                                className="h-full w-full object-contain"
                            />
                        </div>

                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                                Service<span className="text-blue-600 dark:text-blue-400">Flow</span>
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Field Service Management
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 sm:p-10">
                    {mode === "loading" && (
                        <div className="py-8 text-center">
                            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
                            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                                Preparing your invitation...
                            </p>
                        </div>
                    )}

                    {mode === "create" && (
                        <>
                            <div className="mb-8">
                                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                                    Accept your invitation
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    You have been invited to join a ServiceFlow workspace. Create your account to get started.
                                </p>
                            </div>

                            <form
                                onSubmit={handleCreateAccount}
                                className="space-y-5"
                            >
                                <div>
                                    <label htmlFor="firstName" className={labelClass}>
                                        First name
                                    </label>
                                    <input
                                        id="firstName"
                                        type="text"
                                        autoComplete="given-name"
                                        placeholder="Enter your first name"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        required
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="lastName" className={labelClass}>
                                        Last name
                                    </label>
                                    <input
                                        id="lastName"
                                        type="text"
                                        autoComplete="family-name"
                                        placeholder="Enter your last name"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        required
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="newPassword" className={labelClass}>
                                        Create password
                                    </label>

                                    <div className="relative">
                                        <input
                                            id="newPassword"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            placeholder="Create a password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            minLength={8}
                                            className={`${inputClass} pr-12`}
                                        />
                                        {renderPasswordToggle()}
                                    </div>

                                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                                        Use at least 8 characters.
                                    </p>
                                </div>

                                {error && (
                                    <p
                                        role="alert"
                                        className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400"
                                    >
                                        {error}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
                                >
                                    {loading ? "Creating account..." : "Create account"}
                                </button>
                            </form>

                            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                Already have an account?{" "}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode("signin");
                                        setError("");
                                        setShowPassword(false);
                                    }}
                                    className="font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                    Sign in
                                </button>
                            </p>
                        </>
                    )}

                    {mode === "signin" && (
                        <>
                            <div className="mb-8">
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                                    ↗
                                </div>

                                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                                    Sign in to accept
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    This invitation is associated with an existing account. Sign in using the email address that received the invitation.
                                </p>
                            </div>

                            <form
                                onSubmit={handleExistingAccount}
                                className="space-y-5"
                            >
                                <div>
                                    <label htmlFor="email" className={labelClass}>
                                        Email address
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="existingPassword" className={labelClass}>
                                        Password
                                    </label>

                                    <div className="relative">
                                        <input
                                            id="existingPassword"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="current-password"
                                            placeholder="Enter your password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className={`${inputClass} pr-12`}
                                        />
                                        {renderPasswordToggle()}
                                    </div>
                                </div>

                                {error && (
                                    <p
                                        role="alert"
                                        className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400"
                                    >
                                        {error}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
                                >
                                    {loading ? "Signing in..." : "Sign in and accept"}
                                </button>
                            </form>

                            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode("create");
                                        setError("");
                                        setPassword("");
                                        setShowPassword(false);
                                    }}
                                    className="font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                    Create a new account instead
                                </button>
                            </p>
                        </>
                    )}

                    {mode === "success" && (
                        <div className="py-4 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600 dark:bg-green-950/40 dark:text-green-400">
                                ✓
                            </div>

                            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                                Invitation accepted!
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                Your account has been created and you have joined the workspace. Sign in using the email address that received the invitation.
                            </p>

                            <Link
                                href="/login"
                                className="mt-7 block w-full rounded-lg bg-blue-600 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                            >
                                Continue to sign in
                            </Link>
                        </div>
                    )}

                    {mode === "error" && (
                        <div className="py-4 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl text-red-600 dark:bg-red-950/40 dark:text-red-400">
                                !
                            </div>

                            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                                Invitation unavailable
                            </h2>

                            <p
                                role="alert"
                                className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400"
                            >
                                {error}
                            </p>

                            <Link
                                href="/login"
                                className="mt-7 block w-full rounded-lg border border-slate-300 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Back to sign in
                            </Link>
                        </div>
                    )}

                    {mode !== "loading" && mode !== "success" && mode !== "error" && (
                        <p className="mt-8 text-center text-xs leading-5 text-slate-400 dark:text-slate-500">
                            Secure access to your field service operations.
                        </p>
                    )}
                </div>

                {/* Footer */}
                <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
                    © 2026 ServiceFlow. All rights reserved.
                </p>
            </div>
        </main>
    );
}
