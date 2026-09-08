"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    APEX_RADAR_PERFORMANCE_BRIEF_BULK_HREF,
    APEX_RADAR_PERFORMANCE_BRIEF_HREF,
} from "@/lib/apexRadarChannels";

export default function PerformanceBriefNavTabs() {
    const pathname = usePathname() || "";
    const isBulk = pathname.startsWith(APEX_RADAR_PERFORMANCE_BRIEF_BULK_HREF);
    const isSingle =
        pathname === APEX_RADAR_PERFORMANCE_BRIEF_HREF ||
        (pathname.startsWith(`${APEX_RADAR_PERFORMANCE_BRIEF_HREF}/`) && !isBulk);

    return (
        <nav className="apex-radar-brief-tabs" aria-label="Performance Brief views">
            <Link
                href={APEX_RADAR_PERFORMANCE_BRIEF_HREF}
                className={`apex-radar-brief-tabs__link${isSingle ? " is-active" : ""}`}
                aria-current={isSingle ? "page" : undefined}
            >
                Single customer
            </Link>
            <Link
                href={APEX_RADAR_PERFORMANCE_BRIEF_BULK_HREF}
                className={`apex-radar-brief-tabs__link${isBulk ? " is-active" : ""}`}
                aria-current={isBulk ? "page" : undefined}
            >
                Bulk run (dev)
            </Link>
        </nav>
    );
}
