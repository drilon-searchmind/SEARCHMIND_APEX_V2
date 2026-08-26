"use client";

import React from "react";
import Link from "next/link";
import { FiSave } from "react-icons/fi";

const OAUTH_SLOT_OPTIONS = [
    { value: 0, label: "Account 0 — Google Ads (GOOGLE_ADS_*)" },
    { value: 1, label: "Account 1 — MC1 (GOOGLE_MERCHANT_*_1)" },
    { value: 2, label: "Account 2 — MC2 (GOOGLE_MERCHANT_*_2)" },
];

export default function PriceShaperSetupPanel({
    customerId,
    merchantCenterId,
    oauthSlot,
    onMerchantCenterIdChange,
    onOauthSlotChange,
    onSave,
    saving,
    error,
}) {
    const canSave = merchantCenterId.trim().length > 0 && !saving;

    return (
        <section className="apex-ps-setup" aria-labelledby="apex-ps-setup-title">
            <header className="apex-ps-setup__header">
                <h2 id="apex-ps-setup-title" className="apex-ps-setup__title">
                    Connect Merchant Center
                </h2>
                <p className="apex-ps-setup__desc">
                    Enter your Merchant Center account ID and choose which OAuth credentials Price
                    Index should use to load benchmark data.
                </p>
            </header>

            <div className="apex-ps-setup__fields">
                <div className="apex-ps-setup__field">
                    <label className="apex-ps-setup__label" htmlFor="apex-ps-mc-id">
                        Merchant Center account ID
                    </label>
                    <input
                        id="apex-ps-mc-id"
                        type="text"
                        className="apex-ps-setup__input"
                        placeholder="e.g. 123456789"
                        value={merchantCenterId}
                        onChange={(e) => onMerchantCenterIdChange(e.target.value)}
                        autoComplete="off"
                    />
                </div>

                <div className="apex-ps-setup__field">
                    <label className="apex-ps-setup__label" htmlFor="apex-ps-oauth-slot">
                        OAuth account slot
                    </label>
                    <select
                        id="apex-ps-oauth-slot"
                        className="apex-ps-setup__input"
                        value={oauthSlot}
                        onChange={(e) => onOauthSlotChange(Number(e.target.value))}
                    >
                        {OAUTH_SLOT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <p className="apex-ps-setup__hint">
                        Account 0 reuses the shared Google Ads credentials; accounts 1 and 2 use
                        dedicated Merchant Center OAuth apps.
                    </p>
                </div>
            </div>

            {error ? <p className="apex-ps-setup__error">{error}</p> : null}

            <div className="apex-ps-setup__actions">
                <button
                    type="button"
                    className="apex-ps-setup__btn apex-ps-setup__btn--primary"
                    onClick={onSave}
                    disabled={!canSave}
                >
                    <FiSave aria-hidden />
                    Save and load data
                </button>
            </div>

            <p className="apex-ps-setup__footer">
                You can also manage these settings on the{" "}
                <Link href={`/dashboard/${customerId}/config`} className="apex-ps-inline-link">
                    Config page
                </Link>
                .
            </p>
        </section>
    );
}
