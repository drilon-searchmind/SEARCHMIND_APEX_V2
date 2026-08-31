"use client";

import { useEffect, useState } from "react";

/**
 * @param {number} oauthSlot
 * @returns {{ accounts: Array<{ id: string, accountName: string }>, loading: boolean, error: string | null, credentialsMissing: boolean }}
 */
export function useMerchantCenterAccounts(oauthSlot) {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [credentialsMissing, setCredentialsMissing] = useState(false);

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError(null);
        setCredentialsMissing(false);
        setAccounts([]);

        fetch(`/api/merchant-center/accounts?slot=${oauthSlot}`)
            .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                if (cancelled) return;
                if (!ok) {
                    if (data.code === "NO_CREDENTIALS") {
                        setCredentialsMissing(true);
                        setAccounts([]);
                        return;
                    }
                    setError(data.error || "Could not load Merchant Center accounts");
                    setAccounts([]);
                    return;
                }
                setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err.message || "Could not load Merchant Center accounts");
                    setAccounts([]);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [oauthSlot]);

    return { accounts, loading, error, credentialsMissing };
}
