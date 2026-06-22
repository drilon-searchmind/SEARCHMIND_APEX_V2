"use client";

import React from "react";
import Topbar from "@/components/layout/Topbar";

export default function NewsLayout({ children }) {
    return (
        <div className="flex h-screen flex-col">
            <Topbar showLinks={false} showLogo={true} showPropertySection={false} />
            <main className="flex-1 overflow-y-auto bg-[var(--color-paper-2,#f4f6f5)] py-10 px-4 xl:px-20">{children}</main>
        </div>
    );
}
