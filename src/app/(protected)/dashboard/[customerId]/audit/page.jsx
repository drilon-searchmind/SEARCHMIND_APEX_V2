"use client";

import React, { Suspense } from "react";
import AuditReportClient from "./AuditReportClient";
import Spinner from "@/components/ui/Spinner";

function AuditLoading() {
    return (
        <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-gray-200 bg-white">
            <Spinner size={40} color="#406969" />
        </div>
    );
}

export default function AuditPage() {
    return (
        <Suspense fallback={<AuditLoading />}>
            <AuditReportClient />
        </Suspense>
    );
}
