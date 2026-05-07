"use client";

import React from "react";
import ParentPropertySidebar from "@/components/layout/ParentPropertySidebar";
import Topbar from "@/components/layout/Topbar";
import { ParentPropertyViewProvider } from "@/contexts/ParentPropertyViewContext";
import { ParentPropertyFilterProvider } from "@/contexts/ParentPropertyFilterContext";
import { ParentPropertyGroupSettingsProvider } from "@/contexts/ParentPropertyGroupSettingsContext";

const ParentPropertyLayout = ({ children }) => {
    return (
        <ParentPropertyViewProvider>
            <ParentPropertyGroupSettingsProvider>
                <ParentPropertyFilterProvider>
                    <div className="flex h-screen">
                        <ParentPropertySidebar />
                        <div className="flex-1 flex flex-col">
                            <Topbar
                                showLinks={false}
                                showLogo={true}
                                showPropertySection={false}
                                isParentProperty
                            />
                            <main className="flex-1 overflow-y-auto py-10 px-20 bg-slate-50">{children}</main>
                        </div>
                    </div>
                </ParentPropertyFilterProvider>
            </ParentPropertyGroupSettingsProvider>
        </ParentPropertyViewProvider>
    );
};

export default ParentPropertyLayout;
