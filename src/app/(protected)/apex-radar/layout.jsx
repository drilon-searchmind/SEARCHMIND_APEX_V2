"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import ApexRadarSidebar from "@/components/layout/ApexRadarSidebar";
import { useUser } from "@/contexts/UserContext";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";

export default function ApexRadarLayout({ children }) {
    const { status } = useSession();
    const user = useUser();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return;
        if (!user) return;
        if (!canAccessApexRadar(user)) {
            router.replace("/home");
        }
    }, [status, user, router]);

    if (status === "loading") {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-gray-600">
                Loading…
            </div>
        );
    }

    if (user && !canAccessApexRadar(user)) {
        return null;
    }

    return (
        <div className="flex h-screen">
            <ApexRadarSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <Topbar showLinks={false} showLogo={true} showPropertySection={false} />
                <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-10 xl:px-20">
                    {children}
                </main>
            </div>
        </div>
    );
}
