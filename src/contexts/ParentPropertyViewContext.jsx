"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";

export const PARENT_VIEWS = {
    START: "start",
    OVERVIEW: "overview",
    DAILY: "daily",
    PACE_REPORT: "pace-report",
    PNL: "pnl",
    ECOMMERCE: "ecommerce",
};

const PAGE_ID_TO_VIEW = {
    start: PARENT_VIEWS.START,
    overview: PARENT_VIEWS.OVERVIEW,
    daily: PARENT_VIEWS.DAILY,
    "pace-report": PARENT_VIEWS.PACE_REPORT,
    pnl: PARENT_VIEWS.PNL,
    ecommerce: PARENT_VIEWS.ECOMMERCE,
};

const VIEW_TO_PAGE_ID = Object.fromEntries(
    Object.entries(PAGE_ID_TO_VIEW).map(([k, v]) => [v, k])
);

const ParentPropertyViewContext = createContext(null);

export function ParentPropertyViewProvider({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const pageIdFromUrl = searchParams.get("page_id") || "start";

    const [activeView, setActiveViewState] = useState(
        () => PAGE_ID_TO_VIEW[pageIdFromUrl] || PARENT_VIEWS.START
    );

    useEffect(() => {
        const view = PAGE_ID_TO_VIEW[pageIdFromUrl];
        if (view) setActiveViewState(view);
    }, [pageIdFromUrl]);

    const setActiveView = useCallback(
        (view) => {
            setActiveViewState(view);
            const pageId = VIEW_TO_PAGE_ID[view] || "start";
            const params = new URLSearchParams(searchParams.toString());
            params.set("page_id", pageId);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        },
        [pathname, router, searchParams]
    );

    return (
        <ParentPropertyViewContext.Provider value={{ activeView, setActiveView }}>
            {children}
        </ParentPropertyViewContext.Provider>
    );
}

export function useParentPropertyView() {
    const ctx = useContext(ParentPropertyViewContext);
    if (!ctx) {
        throw new Error("useParentPropertyView must be used within ParentPropertyViewProvider");
    }
    return ctx;
}
