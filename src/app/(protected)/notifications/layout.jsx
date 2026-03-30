"use client";

import React from "react";
import Topbar from "@/components/layout/Topbar";

export default function NotificationsLayout({ children }) {
    return (
        <div className="flex h-screen flex-col">
            <Topbar showLinks={false} showLogo={true} showPropertySection={false} />
            <main className="flex-1 overflow-y-auto bg-slate-50 py-10 px-4 xl:px-20">{children}</main>
        </div>
    );
}
