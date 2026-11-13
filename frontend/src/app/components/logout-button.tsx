"use client"

import { useRouter } from "next/navigation";

export function LogoutButton() {
    const router = useRouter();

    function handleLogout() {
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("refreshToken");

        router.replace("/login");
        router.refresh();
    }

    return (
        <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/30 dark:hover:text-red-400"
        >
            Sign out
        </button>
    );
}
