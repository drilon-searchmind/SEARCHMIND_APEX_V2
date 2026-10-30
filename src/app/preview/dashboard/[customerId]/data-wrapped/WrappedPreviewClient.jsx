"use client";

import { useState } from "react";
import WrappedStory from "@/app/(protected)/dashboard/[customerId]/data-wrapped/components/WrappedStory";

export default function WrappedPreviewClient({ data, period, customerName }) {
    const [open, setOpen] = useState(true);
    return open ? (
        <WrappedStory data={data} period={period} customerName={customerName} skipTeam onClose={() => setOpen(false)} />
    ) : (
        <button type="button" onClick={() => setOpen(true)} style={{ margin: 24, padding: "10px 18px", borderRadius: 999, border: "1px solid #D2DBD0", background: "#F6FAF4", font: "600 14px sans-serif", cursor: "pointer" }}>
            Play again
        </button>
    );
}
