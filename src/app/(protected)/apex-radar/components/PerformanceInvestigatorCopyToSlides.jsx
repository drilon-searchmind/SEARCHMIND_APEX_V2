"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiCopy, FiExternalLink, FiLayers, FiUpload } from "react-icons/fi";
import { showToast } from "@/components/ui/ToastProvider";
import {
    buildPerformanceInvestigatorSlidesCopy,
    parsePresentationIdFromInput,
} from "@/lib/apexRadarPerformanceInvestigatorCopy";

const STORAGE_KEY = "apexRadar_pi_slidesPresentationId";

/** Set to true to show the primary "Copy to slides" button again. */
const SHOW_COPY_TO_SLIDES_BUTTON = false;

export default function PerformanceInvestigatorCopyToSlides({
    disabled = false,
    headingLabel,
    currentYear,
    previousYear,
    currentYearRows,
    previousYearRows,
    diffRows,
    funnel,
    funnelRange,
    compareHint,
}) {
    const [modalOpen, setModalOpen] = useState(false);
    const [presentationInput, setPresentationInput] = useState("");
    const [slidesApi, setSlidesApi] = useState({ enabled: false, shareWithEmail: null });
    const [appendBusy, setAppendBusy] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setPresentationInput(saved);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/apex-radar/google-slides/config");
                const data = await res.json().catch(() => ({}));
                if (!cancelled) {
                    setSlidesApi({
                        enabled: !!data.enabled,
                        shareWithEmail: data.shareWithEmail || null,
                    });
                }
            } catch {
                if (!cancelled) setSlidesApi({ enabled: false, shareWithEmail: null });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const exportPayload = useMemo(
        () => ({
            title: "Performance Investigator",
            customerLabel: headingLabel || "",
            currentYear,
            previousYear,
            currentYearRows: currentYearRows ?? [],
            previousYearRows: previousYearRows ?? [],
            diffRows,
            funnel,
            funnelRange,
            compareHint,
        }),
        [
            headingLabel,
            currentYear,
            previousYear,
            currentYearRows,
            previousYearRows,
            diffRows,
            funnel,
            funnelRange,
            compareHint,
        ]
    );

    const { text } = useMemo(
        () => buildPerformanceInvestigatorSlidesCopy(exportPayload),
        [exportPayload]
    );

    const copyToClipboard = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            showToast({
                message: "Copied — paste into Slides, Sheets, or PowerPoint",
                type: "success",
                position: "top-center",
            });
        } catch (e) {
            showToast({
                message: e?.message || "Could not copy",
                type: "error",
                position: "top-center",
            });
        }
    }, [text]);

    const downloadTxt = useCallback(() => {
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `performance-investigator_${currentYear ?? "export"}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showToast({ message: "Download started", type: "success", position: "top-center" });
    }, [text, currentYear]);

    const persistPresentationId = useCallback((value) => {
        setPresentationInput(value);
        try {
            if (value.trim()) localStorage.setItem(STORAGE_KEY, value.trim());
            else localStorage.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
    }, []);

    const presentationId = useMemo(
        () => parsePresentationIdFromInput(presentationInput),
        [presentationInput]
    );

    const openInSlides = useMemo(() => {
        if (!presentationId) return null;
        return `https://docs.google.com/presentation/d/${presentationId}/edit`;
    }, [presentationId]);

    const appendToGoogleSlides = useCallback(async () => {
        if (!presentationId) {
            showToast({
                message: "Paste a valid Google Slides link or presentation ID",
                type: "error",
                position: "top-center",
            });
            return;
        }
        setAppendBusy(true);
        try {
            const res = await fetch("/api/apex-radar/google-slides/append-performance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ presentationId, exportPayload }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "Could not append to presentation");
            }
            showToast({
                message: data.message || "Added a new slide with the data",
                type: "success",
                position: "top-center",
            });
            setModalOpen(false);
        } catch (e) {
            showToast({
                message: e?.message || "Append failed",
                type: "error",
                position: "top-center",
            });
        } finally {
            setAppendBusy(false);
        }
    }, [presentationId, exportPayload]);

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                {SHOW_COPY_TO_SLIDES_BUTTON && (
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={copyToClipboard}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                        <FiCopy className="h-4 w-4 shrink-0" />
                        Copy to slides
                    </button>
                )}
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                    <FiLayers className="h-4 w-4 shrink-0" />
                    Slides options
                </button>
            </div>

            {modalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="pi-slides-modal-title"
                >
                    <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between gap-3">
                            <h2 id="pi-slides-modal-title" className="text-lg font-semibold text-gray-900">
                                Copy to Google Slides
                            </h2>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="text-gray-500 hover:text-gray-800 text-sm"
                            >
                                Close
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-gray-700">
                                Google Slides presentation URL or ID
                            </label>
                            <input
                                type="text"
                                value={presentationInput}
                                onChange={(e) => persistPresentationId(e.target.value)}
                                placeholder="https://docs.google.com/presentation/d/XXXXXXXX/edit"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                            {openInSlides && (
                                <a
                                    href={openInSlides}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm text-[var(--color-primary-searchmind)] hover:underline"
                                >
                                    <FiExternalLink className="h-4 w-4" />
                                    Open this presentation
                                </a>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={copyToClipboard}
                                disabled={disabled}
                                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary-searchmind)] text-white px-4 py-2 text-sm font-medium hover:opacity-95 disabled:opacity-50"
                            >
                                <FiCopy className="h-4 w-4" />
                                Copy data again
                            </button>
                            <button
                                type="button"
                                onClick={downloadTxt}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                            >
                                <FiUpload className="h-4 w-4" />
                                Download .txt
                            </button>
                        </div>

                        {slidesApi.enabled ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 space-y-3 text-sm">
                                <p className="font-medium text-emerald-900">Server append is enabled</p>
                                <p className="text-emerald-800">
                                    Share this presentation with{" "}
                                    <code className="rounded bg-white/80 px-1 py-0.5 text-xs">
                                        {slidesApi.shareWithEmail || "the service account email"}
                                    </code>{" "}
                                    as <strong>Editor</strong>, then append adds formatted slides (one section per slide,
                                    tables styled like Performance Investigator).
                                </p>
                                <button
                                    type="button"
                                    disabled={appendBusy || disabled || !presentationId}
                                    onClick={appendToGoogleSlides}
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50"
                                >
                                    {appendBusy ? "Working…" : "Append to presentation (new slides)"}
                                </button>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
                                <p className="font-medium mb-1">Google Slides API (optional)</p>
                                <p className="text-amber-900/90">
                                    Automatic append is off until the server has a service account with the Slides API
                                    enabled — either reuse{" "}
                                    <code className="text-xs rounded bg-white/60 px-1">
                                        GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS
                                    </code>{" "}
                                    or set{" "}
                                    <code className="text-xs rounded bg-white/60 px-1">
                                        GOOGLE_SLIDES_SERVICE_ACCOUNT_JSON
                                    </code>
                                    . Until then, use <strong>Copy data again</strong> below and paste manually.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
