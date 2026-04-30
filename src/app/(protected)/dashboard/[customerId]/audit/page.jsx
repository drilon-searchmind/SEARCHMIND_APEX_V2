"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AuditReportClient from "./AuditReportClient";
import AuditListClient from "./AuditListClient";
import Spinner from "@/components/ui/Spinner";

function AuditLoading() {
    return (
        <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-gray-200 bg-white">
            <Spinner size={40} color="#406969" />
        </div>
    );
}

function AuditRouter() {
    const searchParams = useSearchParams();
    const auditId = searchParams.get("audit_id");
    if (auditId) {
        return <AuditReportClient />;
    }
    return <AuditListClient />;
}

export default function AuditPage() {
    return (
        <Suspense fallback={<AuditLoading />}>
            <AuditRouter />
        </Suspense>
    );
}
