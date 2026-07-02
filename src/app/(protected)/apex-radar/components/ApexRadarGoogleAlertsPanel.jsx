"use client";

import ApexRadarAlertsPanel from "./ApexRadarAlertsPanel";

/** @deprecated Use `ApexRadarAlertsPanel` with `platformLabel`. Kept for compatibility. */
export default function ApexRadarGoogleAlertsPanel(props) {
    return (
        <ApexRadarAlertsPanel
            {...props}
            platformLabel={props.platformLabel ?? "Google Ads"}
            channel={props.channel ?? "google-ads"}
        />
    );
}
