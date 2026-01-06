"use client"

import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

const ProfilePageLayout = ({ children }) => {
    return (
        <div className="flex h-screen">
            <Sidebar showLinks={false} />
            <div className="flex-1 flex flex-col">
                <Topbar showLinks={false} />
                <main className="flex-1 overflow-y-auto py-10 px-20 bg-slate-50">{children}</main>
            </div>
        </div>
    );
};

export default ProfilePageLayout;