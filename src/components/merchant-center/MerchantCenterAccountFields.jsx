"use client";

import React, { useMemo } from "react";
import { normalizeMerchantAccountId } from "@/lib/merchantCenter/merchantCenterAccounts";
import { useMerchantCenterAccounts } from "@/hooks/useMerchantCenterAccounts";

export const MERCHANT_OAUTH_SLOT_OPTIONS = [
    { value: 0, label: "Account 0 — Google Ads (GOOGLE_ADS_*)" },
    { value: 1, label: "Account 1 — MC1 (GOOGLE_MERCHANT_*_1)" },
    { value: 2, label: "Account 2 — MC2 (GOOGLE_MERCHANT_*_2)" },
];

export default function MerchantCenterAccountFields({
    merchantCenterId,
    oauthSlot,
    onMerchantCenterIdChange,
    onOauthSlotChange,
    idPrefix = "merchant-center",
    fieldClassName = "apex-ps-setup__field",
    labelClassName = "apex-ps-setup__label",
    inputClassName = "apex-ps-setup__input",
    hintClassName = "apex-ps-setup__hint",
    pickerClassName = "apex-ps-setup__input",
    errorClassName = "apex-ps-setup__error",
}) {
    const { accounts, loading, error, credentialsMissing } = useMerchantCenterAccounts(oauthSlot);

    const normalizedCurrentId = useMemo(
        () => normalizeMerchantAccountId(merchantCenterId),
        [merchantCenterId]
    );

    const pickerValue = useMemo(() => {
        if (!normalizedCurrentId) return "";
        return accounts.some((account) => account.id === normalizedCurrentId)
            ? normalizedCurrentId
            : "";
    }, [accounts, normalizedCurrentId]);

    const handlePickerChange = (event) => {
        const nextId = event.target.value;
        if (nextId) onMerchantCenterIdChange(nextId);
    };

    return (
        <>
            <div className={fieldClassName}>
                <label className={labelClassName} htmlFor={`${idPrefix}-oauth-slot`}>
                    OAuth account slot
                </label>
                <select
                    id={`${idPrefix}-oauth-slot`}
                    className={inputClassName}
                    value={oauthSlot}
                    onChange={(event) => onOauthSlotChange(Number(event.target.value))}
                >
                    {MERCHANT_OAUTH_SLOT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <p className={hintClassName}>
                    Account 0 reuses the shared Google Ads credentials; accounts 1 and 2 use
                    dedicated Merchant Center OAuth apps. Available accounts below depend on this
                    slot.
                </p>
            </div>

            <div className={fieldClassName}>
                <label className={labelClassName} htmlFor={`${idPrefix}-account-picker`}>
                    Select account
                </label>
                <select
                    id={`${idPrefix}-account-picker`}
                    className={pickerClassName}
                    value={pickerValue}
                    onChange={handlePickerChange}
                    disabled={loading || credentialsMissing || accounts.length === 0}
                >
                    <option value="">
                        {loading
                            ? "Loading accounts…"
                            : credentialsMissing
                              ? "OAuth credentials not configured for this slot"
                              : accounts.length === 0
                                ? "No accounts found for this slot"
                                : "Choose an account…"}
                    </option>
                    {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.accountName && account.accountName !== account.id
                                ? `${account.accountName} (${account.id})`
                                : account.id}
                        </option>
                    ))}
                </select>
                {error ? <p className={errorClassName}>{error}</p> : null}
                {!loading && !credentialsMissing && accounts.length > 0 ? (
                    <p className={hintClassName}>
                        {accounts.length} account{accounts.length === 1 ? "" : "s"} available via
                        this OAuth slot.
                    </p>
                ) : null}
            </div>

            <div className={fieldClassName}>
                <label className={labelClassName} htmlFor={`${idPrefix}-mc-id`}>
                    Merchant Center account ID
                </label>
                <input
                    id={`${idPrefix}-mc-id`}
                    type="text"
                    className={inputClassName}
                    placeholder="e.g. 123456789"
                    value={merchantCenterId}
                    onChange={(event) => onMerchantCenterIdChange(event.target.value)}
                    autoComplete="off"
                />
                <p className={hintClassName}>
                    Pick from the list above or enter an account ID manually.
                </p>
            </div>
        </>
    );
}
