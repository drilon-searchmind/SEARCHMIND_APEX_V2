"use client";

import React from "react";
import Topbar from "./Topbar";
import "@/app/(protected)/dashboard/dashboard-shell.css";
import "@/app/(protected)/home/home.css";

/** Full-width minimal shell with topbar only (no sidebar). */
export default function StandaloneTopbarShell({
    children,
    showLinks = false,
    showLogo = true,
    showPropertySection = false,
    isParentProperty = false,
    mainClassName = "",
}) {
    return (
        <div className="apex-dashboard flex h-screen flex-col">
            <Topbar
                showLinks={showLinks}
                showLogo={showLogo}
                showPropertySection={showPropertySection}
                isParentProperty={isParentProperty}
            />
            <main
                className={[
                    "apex-dash__content",
                    "bg-[var(--apex-canvas,#f4f3f1)]",
                    mainClassName,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {children}
            </main>
        </div>
    );
}
