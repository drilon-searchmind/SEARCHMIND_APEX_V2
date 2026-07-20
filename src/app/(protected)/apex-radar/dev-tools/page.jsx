"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useApexRadarDevToolsAccess } from "../hooks/useApexRadarDevToolsAccess";
import ApexRadarDevToolsClient from "./ApexRadarDevToolsClient";

export default function ApexRadarDevToolsPage() {
    const router = useRouter();
    const { allowed, checked } = useApexRadarDevToolsAccess();

    useEffect(() => {
        if (!checked) return;
        if (!allowed) {
            router.replace("/apex-radar");
        }
    }, [allowed, checked, router]);

    if (!checked) {
        return (
            <div className="apex-perf flex min-h-[40vh] items-center justify-center">
                <CobaltLoader variant="block" title="Checking access" />
            </div>
        );
    }

    if (!allowed) {
        return null;
    }

    return <ApexRadarDevToolsClient />;
}
