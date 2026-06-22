"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import ApexRadarSidebar from "@/components/layout/ApexRadarSidebar";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useUser } from "@/contexts/UserContext";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import "../home/home.css";
import "../dashboard/dashboard-shell.css";
import "./apex-radar.css";

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
            <div className="cobalt-perf flex h-screen items-center justify-center bg-[var(--color-paper-2,#f4f6f5)]" data-theme="cobalt">
                <CobaltLoader variant="block" title="Loading Apex Radar" />
            </div>
        );
    }

    if (user && !canAccessApexRadar(user)) {
        return null;
    }

    return (
        <div className="cobalt-dashboard cobalt-perf flex h-screen" data-theme="cobalt">
            <ApexRadarSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <Topbar showLinks={false} showLogo={true} showPropertySection={false} />
                <main className="apex-dash__content">{children}</main>
            </div>
        </div>
    );
}
