"use client";

import React from "react";
import Link from "next/link";
import { FiSave } from "react-icons/fi";
import MerchantCenterAccountFields from "@/components/merchant-center/MerchantCenterAccountFields";

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
                    Choose OAuth credentials, pick a Merchant Center account from the list, or enter
                    an account ID manually.
                </p>
            </header>

            <div className="apex-ps-setup__fields">
                <MerchantCenterAccountFields
                    merchantCenterId={merchantCenterId}
                    oauthSlot={oauthSlot}
                    onMerchantCenterIdChange={onMerchantCenterIdChange}
                    onOauthSlotChange={onOauthSlotChange}
                    idPrefix="apex-ps-mc"
                />
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
