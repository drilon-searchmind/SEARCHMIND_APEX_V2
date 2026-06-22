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
                        className="apex-perf-btn apex-perf-btn--secondary"
                    >
                        <FiCopy className="h-4 w-4 shrink-0" />
                        Copy to slides
                    </button>
                )}
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setModalOpen(true)}
                    className="apex-perf-btn apex-perf-btn--secondary"
                >
                    <FiLayers className="h-4 w-4 shrink-0" />
                    Slides options
                </button>
            </div>

            {modalOpen && (
                <div
                    className="apex-radar-modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="pi-slides-modal-title"
                >
                    <div className="apex-radar-modal apex-radar-modal--lg">
                        <div className="apex-radar-modal__head">
                            <h2 id="pi-slides-modal-title" className="apex-radar-modal__title">
                                Copy to Google Slides
                            </h2>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="apex-radar-modal__close"
                            >
                                Close
                            </button>
                        </div>

                        <div className="apex-radar-modal__body apex-radar-form space-y-4">
                            <div>
                                <label className="apex-radar-field-label">
                                    Google Slides presentation URL or ID
                                </label>
                                <input
                                    type="text"
                                    value={presentationInput}
                                    onChange={(e) => persistPresentationId(e.target.value)}
                                    placeholder="https://docs.google.com/presentation/d/XXXXXXXX/edit"
                                />
                                {openInSlides && (
                                    <a
                                        href={openInSlides}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="apex-radar-link inline-flex items-center gap-1.5 mt-2"
                                    >
                                        <FiExternalLink className="h-4 w-4" />
                                        Open this presentation
                                    </a>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-rule)]">
                                <button
                                    type="button"
                                    onClick={copyToClipboard}
                                    disabled={disabled}
                                    className="apex-perf-btn apex-perf-btn--primary"
                                >
                                    <FiCopy className="h-4 w-4" />
                                    Copy data again
                                </button>
                                <button
                                    type="button"
                                    onClick={downloadTxt}
                                    className="apex-perf-btn apex-perf-btn--secondary"
                                >
                                    <FiUpload className="h-4 w-4" />
                                    Download .txt
                                </button>
                            </div>

                            {slidesApi.enabled ? (
                                <div className="apex-radar-modal-callout space-y-3">
                                    <p className="font-medium text-[var(--color-ink)]">Server append is enabled</p>
                                    <p>
                                        Share this presentation with{" "}
                                        <code>{slidesApi.shareWithEmail || "the service account email"}</code> as{" "}
                                        <strong>Editor</strong>, then append adds formatted slides (one section per
                                        slide, tables styled like Performance Investigator).
                                    </p>
                                    <button
                                        type="button"
                                        disabled={appendBusy || disabled || !presentationId}
                                        onClick={appendToGoogleSlides}
                                        className="apex-perf-btn apex-perf-btn--primary"
                                    >
                                        {appendBusy ? "Working…" : "Append to presentation (new slides)"}
                                    </button>
                                </div>
                            ) : (
                                <div className="apex-radar-alert">
                                    <p className="font-medium mb-1">Google Slides API (optional)</p>
                                    <p>
                                        Automatic append is off until the server has a service account with the Slides
                                        API enabled — either reuse{" "}
                                        <code>GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS</code> or set{" "}
                                        <code>GOOGLE_SLIDES_SERVICE_ACCOUNT_JSON</code>. Until then, use{" "}
                                        <strong>Copy data again</strong> below and paste manually.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
