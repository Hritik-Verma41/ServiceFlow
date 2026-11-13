"use client";

import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";

interface CompanyMembership {
    company_id: string;
    company_name: string;
    role: string;
    status: string;
}

export interface CurrentUser {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    phone: string;
    memberships: CompanyMembership[];
}

interface CurrentUserContextType {
    user: CurrentUser | null;
    loading: boolean;
}

const CurrentUserContext = createContext<CurrentUserContextType>({
    user: null,
    loading: true,
});

export function CurrentUserProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        async function fetchCurrentUser() {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
                const token = sessionStorage.getItem("accessToken");

                if (!apiUrl || !token) {
                    throw new Error("API configuration or session is missing.");
                }

                const response = await fetch(
                    `${apiUrl}/api/accounts/me/`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                if (!response.ok) {
                    throw new Error("Unable to load your profile.");
                }

                const data: CurrentUser = await response.json();

                if (active) {
                    setUser(data);
                }
            } catch (error) {
                console.error("Current user profile error:", error);
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        fetchCurrentUser();

        return () => {
            active = false;
        };
    }, []);

    return (
        <CurrentUserContext.Provider value={{ user, loading }}>
            {children}
        </CurrentUserContext.Provider>
    );
}

export function useCurrentUser() {
    return useContext(CurrentUserContext);
}
