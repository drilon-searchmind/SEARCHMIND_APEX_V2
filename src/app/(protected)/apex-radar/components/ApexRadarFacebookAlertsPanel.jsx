"use client";

import ApexRadarAlertsPanel from "./ApexRadarAlertsPanel";

/** Meta PS wrapper — same Slack + Active warnings panel as Google Ads. */
export default function ApexRadarFacebookAlertsPanel(props) {
    return (
        <ApexRadarAlertsPanel
            {...props}
            platformLabel={props.platformLabel ?? "Facebook (PS)"}
            channel={props.channel ?? "facebook"}
        />
    );
}
