"use client";

import React from "react";
import ParentPropertySidebar from "@/components/layout/ParentPropertySidebar";
import Topbar from "@/components/layout/Topbar";
import { ParentPropertyViewProvider } from "@/contexts/ParentPropertyViewContext";
import { ParentPropertyFilterProvider } from "@/contexts/ParentPropertyFilterContext";
import { ParentPropertyGroupSettingsProvider } from "@/contexts/ParentPropertyGroupSettingsContext";
import "../dashboard/dashboard-shell.css";
import "./parent-property.css";

const ParentPropertyLayout = ({ children }) => {
    return (
        <ParentPropertyViewProvider>
            <ParentPropertyGroupSettingsProvider>
                <ParentPropertyFilterProvider>
                    <div className="apex-dashboard flex h-screen">
                        <ParentPropertySidebar />
                        <div className="flex min-w-0 flex-1 flex-col">
                            <Topbar
                                showLinks={false}
                                showLogo={true}
                                showPropertySection={false}
                                isParentProperty
                            />
                            <main className="apex-dash__content">{children}</main>
                        </div>
                    </div>
                </ParentPropertyFilterProvider>
            </ParentPropertyGroupSettingsProvider>
        </ParentPropertyViewProvider>
    );
};

export default ParentPropertyLayout;
