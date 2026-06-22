"use client"

import React from "react";
import Topbar from "@/components/layout/Topbar";

const OurToolsPageLayout = ({ children }) => {
    return (
        <div className="flex h-screen">
            <div className="flex-1 flex flex-col">
                <Topbar showLinks={false} showLogo={true} showPropertySection={false} />
                <main className="flex-1 overflow-y-auto md:py-10 md:px-20 py-10 px-4 bg-[var(--color-paper-2,#f4f6f5)]">{children}</main>
            </div>
        </div>
    );
};

export default OurToolsPageLayout;