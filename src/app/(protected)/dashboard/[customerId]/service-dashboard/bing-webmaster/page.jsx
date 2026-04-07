"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import FormButton from "@/components/form/FormButton";
import { showToast } from "@/components/ui/ToastProvider";
import { FiGlobe } from "react-icons/fi";

function BingWebmasterTestInner() {
    const params = useParams();
    const searchParams = useSearchParams();
    const customerId = params.customerId;
    const returnTo = `/dashboard/${customerId}/service-dashboard/bing-webmaster`;

    const [status, setStatus] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState(false);
    const [origin, setOrigin] = useState("");

    const loadStatus = useCallback(async () => {
        setLoadingStatus(true);
        try {
            const r = await fetch("/api/bing-webmaster/status");
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Status failed");
            setStatus(d);
        } catch (e) {
            setStatus({ error: e.message });
        } finally {
            setLoadingStatus(false);
        }
    }, []);

    useEffect(() => {
        setOrigin(typeof window !== "undefined" ? window.location.origin : "");
    }, []);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    useEffect(() => {
        const connected = searchParams.get("bing_wm");
        const err = searchParams.get("bing_wm_error");
        if (connected === "connected") {
            showToast({ type: "success", message: "Bing Webmaster connected." });
            loadStatus();
            if (typeof window !== "undefined") {
                const u = new URL(window.location.href);
                u.searchParams.delete("bing_wm");
                window.history.replaceState({}, "", u.pathname + u.search);
            }
        }
        if (err) {
            showToast({ type: "error", message: decodeURIComponent(err) });
            if (typeof window !== "undefined") {
                const u = new URL(window.location.href);
                u.searchParams.delete("bing_wm_error");
                window.history.replaceState({}, "", u.pathname + u.search);
            }
        }
    }, [searchParams, loadStatus]);

    const connectHref = `/api/bing-webmaster/oauth/authorize?returnTo=${encodeURIComponent(returnTo)}`;
    const callbackExample = origin ? `${origin}/api/bing-webmaster/oauth/callback` : "https://your-domain/api/bing-webmaster/oauth/callback";

    const runTestSites = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const r = await fetch("/api/bing-webmaster/test-sites");
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || d.detail || "Request failed");
            setTestResult(d);
            showToast({ type: "success", message: "API call succeeded" });
            loadStatus();
        } catch (e) {
            setTestResult({ error: e.message });
            showToast({ type: "error", message: e.message });
        } finally {
            setTesting(false);
        }
    };

    const disconnect = async () => {
        try {
            const r = await fetch("/api/bing-webmaster/oauth/disconnect", { method: "POST" });
            if (!r.ok) {
                const d = await r.json().catch(() => ({}));
                throw new Error(d.error || "Disconnect failed");
            }
            showToast({ type: "success", message: "Disconnected" });
            setTestResult(null);
            loadStatus();
        } catch (e) {
            showToast({ type: "error", message: e.message });
        }
    };

    return (
        <div className="w-full min-w-0 max-w-full">
            <DashboardHeading
                title="Bing Webmaster"
                label="OAuth & API test"
                customerId={customerId}
                showRight={false}
                showPdfExport={false}
                showAnalyzeWithAi={false}
            />

            <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl space-y-6">
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-[var(--color-primary-searchmind)]">
                        <FiGlobe className="w-6 h-6" />
                    </span>
                    <div className="space-y-2 text-sm text-gray-700">
                        <p>
                            Connect your Bing Webmaster account using OAuth 2.0 (
                            <a
                                className="text-[var(--color-primary-searchmind)] underline font-medium"
                                href="https://learn.microsoft.com/en-us/bingwebmaster/oauth2"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Microsoft docs
                            </a>
                            ). Tokens are stored in HTTP-only cookies for this test page only.
                        </p>
                        <p className="text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs">
                            <strong>Redirect URI:</strong> register{" "}
                            <code className="bg-white px-1 rounded">{callbackExample}</code> in Bing Webmaster → Settings →
                            API Access → OAuth client. It must match{" "}
                            <code className="bg-white px-1 rounded">MICROSOFT_BING_REDIRECT_URI</code> exactly (slashes
                            matter). Using only the site root <code className="bg-white px-1">/</code> will not receive the
                            OAuth <code className="bg-white px-1">code</code>.
                        </p>
                        <p className="text-xs text-gray-500">
                            Env: <code>MICROSOFT_BING_CLIENT_ID</code>, <code>MICROSOFT_BING_CLIENT_SECRET</code>,{" "}
                            <code>MICROSOFT_BING_REDIRECT_URI</code>, optional <code>MICROSOFT_BING_API</code> (JSON API
                            base). <code>MICROSOFT_BING_USER_ID</code> is not used by this OAuth flow. If Bing does not
                            allow localhost as a redirect, sign in against your deployed app (e.g. apex) instead.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <a
                        href={connectHref}
                        className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary-searchmind)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 shadow-sm"
                    >
                        Connect Bing Webmaster
                    </a>
                    <FormButton borderType="secondary" type="button" onClick={runTestSites} disabled={testing}>
                        {testing ? "Calling API…" : "Test: GetUserSites"}
                    </FormButton>
                    <FormButton borderType="secondary" type="button" onClick={disconnect}>
                        Disconnect (clear cookies)
                    </FormButton>
                    <FormButton borderType="secondary" type="button" onClick={loadStatus} disabled={loadingStatus}>
                        Refresh status
                    </FormButton>
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Status</h3>
                    {loadingStatus ? (
                        <p className="text-sm text-gray-500">Loading…</p>
                    ) : (
                        <pre className="text-xs bg-slate-50 border border-slate-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words">
                            {JSON.stringify(status, null, 2)}
                        </pre>
                    )}
                </div>

                {testResult ? (
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Last API response</h3>
                        <pre className="text-xs bg-slate-50 border border-slate-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words max-h-[min(60vh,480px)]">
                            {JSON.stringify(testResult, null, 2)}
                        </pre>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function BingWebmasterTestPage() {
    return (
        <Suspense
            fallback={
                <div className="p-8 text-sm text-gray-500">Loading Bing Webmaster…</div>
            }
        >
            <BingWebmasterTestInner />
        </Suspense>
    );
}
