"use client";

import React from "react";
import Topbar from "./Topbar";
import "@/app/(protected)/dashboard/dashboard-shell.css";
import "@/app/(protected)/home/home.css";

/** Full-width cobalt shell with topbar only (no sidebar). */
export default function StandaloneTopbarShell({
    children,
    showLinks = false,
    showLogo = true,
    showPropertySection = false,
    isParentProperty = false,
    mainClassName = "",
}) {
    return (
        <div className="cobalt-dashboard flex h-screen flex-col" data-theme="cobalt">
            <Topbar
                showLinks={showLinks}
                showLogo={showLogo}
                showPropertySection={showPropertySection}
                isParentProperty={isParentProperty}
            />
            <main
                className={[
                    "apex-dash__content",
                    "bg-[var(--color-paper-2,#f4f6f5)]",
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
