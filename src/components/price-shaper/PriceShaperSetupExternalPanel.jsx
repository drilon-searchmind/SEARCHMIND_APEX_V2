"use client";

import React from "react";

export default function PriceShaperSetupExternalPanel() {
    return (
        <section className="apex-ps-setup apex-ps-setup--external" aria-labelledby="apex-ps-setup-external-title">
            <header className="apex-ps-setup__header">
                <h2 id="apex-ps-setup-external-title" className="apex-ps-setup__title">
                    Merchant Center not configured
                </h2>
                <p className="apex-ps-setup__desc">
                    Price Index needs a Merchant Center account ID before benchmark data can load for
                    this property.
                </p>
            </header>

            <div className="apex-ps-setup__notice">
                <p>
                    Ask Searchmind to add your Merchant Center account ID for this property. Shared
                    report users cannot change integration settings.
                </p>
            </div>
        </section>
    );
}
