"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";

export const DASHBOARD_VIEWS = {
    OVERVIEW: "overview",
    DAILY: "daily",
    MARKETS: "markets",
    PACE_REPORT: "pace-report",
    PNL: "pnl",
    ECOMMERCE: "ecommerce",
};

const PAGE_ID_TO_VIEW = {
    overview: DASHBOARD_VIEWS.OVERVIEW,
    daily: DASHBOARD_VIEWS.DAILY,
    markets: DASHBOARD_VIEWS.MARKETS,
    "pace-report": DASHBOARD_VIEWS.PACE_REPORT,
    pnl: DASHBOARD_VIEWS.PNL,
    ecommerce: DASHBOARD_VIEWS.ECOMMERCE,
};

const VIEW_TO_PAGE_ID = Object.fromEntries(
    Object.entries(PAGE_ID_TO_VIEW).map(([k, v]) => [v, k])
);

const DashboardViewContext = createContext(null);

export function DashboardViewProvider({ children, defaultView = DASHBOARD_VIEWS.OVERVIEW }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const pageIdFromUrl = searchParams.get("page_id") || VIEW_TO_PAGE_ID[defaultView] || "overview";

    const [activeView, setActiveViewState] = useState(
        () => PAGE_ID_TO_VIEW[pageIdFromUrl] || defaultView
    );

    useEffect(() => {
        const view = PAGE_ID_TO_VIEW[pageIdFromUrl];
        if (view) setActiveViewState(view);
    }, [pageIdFromUrl]);

    const setActiveView = useCallback(
        (view) => {
            setActiveViewState(view);
            const pageId = VIEW_TO_PAGE_ID[view] || "overview";
            const params = new URLSearchParams(searchParams.toString());
            params.set("page_id", pageId);
            const tab = params.get("tab");
            if (view !== DASHBOARD_VIEWS.ECOMMERCE && tab) {
                params.delete("tab");
            }
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        },
        [pathname, router, searchParams]
    );

    return (
        <DashboardViewContext.Provider value={{ activeView, setActiveView }}>
            {children}
        </DashboardViewContext.Provider>
    );
}

export function useDashboardView() {
    const ctx = useContext(DashboardViewContext);
    if (!ctx) {
        throw new Error("useDashboardView must be used within DashboardViewProvider");
    }
    return ctx;
}

export function useDashboardViewOptional() {
    return useContext(DashboardViewContext);
}
