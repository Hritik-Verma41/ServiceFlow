"use client"

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface AuthGuardProps {
    children: ReactNode;
}

function isTokenExpired(token: string): boolean {
    try {
        const payload = token.split(".")[1];

        if (!payload) return true;

        const base64 = payload
            .replace(/-/g, "+")
            .replace(/-/g, "/");

        const decoded = JSON.parse(atob(base64));

        if (typeof decoded.exp !== "number") return true;

        return decoded.exp * 1000 <= Date.now() + 30000;
    } catch {
        return true;
    }
}

export function AuthGuard({ children }: AuthGuardProps) {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        let active = true;

        async function verifyAuthentication() {
            const accessToken = sessionStorage.getItem("accessToken");
            const refreshToken = sessionStorage.getItem("refreshToken");

            if (!accessToken && !refreshToken) {
                router.replace("/login");
                return;
            }

            if (accessToken && !isTokenExpired(accessToken)) {
                if (active) setAuthorized(true);
                return;
            }

            if (!refreshToken) {
                sessionStorage.removeItem("accessToken");
                sessionStorage.removeItem("refreshToken");
                router.replace("/login");
                return;
            }

            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

                if (!apiUrl) {
                    throw new Error("API URL is not configured.");
                }

                const response = await fetch(
                    `${apiUrl}/api/auth/token/refresh/`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            refresh: refreshToken,
                        }),
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.access) {
                    throw new Error("Session expired.");
                }

                sessionStorage.setItem("accessToken", data.access);

                if (data.refresh) {
                    sessionStorage.setItem("refreshToken", data.refresh);
                }

                if (active) setAuthorized(true);
            } catch {
                sessionStorage.removeItem("accessToken");
                sessionStorage.removeItem("refreshToken");
            }
        }

        verifyAuthentication();

        return () => {
            active = false;
        };
    }, [router]);

    if (!authorized) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Verifying your session...
                </p>
            </div>
        );
    }

    return <>{children}</>
}
