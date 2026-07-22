"use client";

import React from "react";
import { useDashboardView, DASHBOARD_VIEWS } from "@/contexts/DashboardViewContext";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import CobaltLoader from "@/components/ui/CobaltLoader";
import PerformanceDashboard from "../performance-dashboard/page";
import DailyOverviewPage from "../daily-overview/page";
import MarketsOverviewPage from "../markets-overview/page";
import PaceReportPage from "../tools/pace-report/page";
import PNLPage from "../tools/pnl/page";
import EcommercePage from "../ecommerce/page";
import ViewSlot from "./ViewSlot";

export default function DashboardHomePage() {
    const { activeView } = useDashboardView();
    const { isB2B, isShopifyMarkets, isPrefetchReady } = useDashboardData();

    if (!isPrefetchReady) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <CobaltLoader />
            </div>
        );
    }

    return (
        <>
            <ViewSlot active={activeView === DASHBOARD_VIEWS.OVERVIEW}>
                <PerformanceDashboard />
            </ViewSlot>
            <ViewSlot active={activeView === DASHBOARD_VIEWS.DAILY}>
                <DailyOverviewPage />
            </ViewSlot>
            {isShopifyMarkets && !isB2B ? (
                <ViewSlot active={activeView === DASHBOARD_VIEWS.MARKETS}>
                    <MarketsOverviewPage />
                </ViewSlot>
            ) : null}
            {!isB2B ? (
                <>
                    <ViewSlot active={activeView === DASHBOARD_VIEWS.PACE_REPORT}>
                        <PaceReportPage />
                    </ViewSlot>
                    <ViewSlot active={activeView === DASHBOARD_VIEWS.PNL}>
                        <PNLPage />
                    </ViewSlot>
                    {activeView === DASHBOARD_VIEWS.ECOMMERCE ? <EcommercePage /> : null}
                </>
            ) : null}
        </>
    );
}
