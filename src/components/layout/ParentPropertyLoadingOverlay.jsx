"use client";

import React from "react";
import { FiCheck, FiLoader } from "react-icons/fi";
import CobaltLoader from "@/components/ui/CobaltLoader";

export default function ParentPropertyLoadingOverlay({
    visible,
    phase,
    parentName,
    items = [],
    fading = false,
}) {
    if (!visible) return null;

    const loadedCount = items.filter((i) => i.status === "loaded").length;
    const totalCount = items.length;

    return (
        <div
            className={`apex-parent-overlay cobalt-perf${fading ? " is-fading" : ""}`}
            data-theme="cobalt"
        >
            <div className="apex-parent-overlay__card">
                <div className="flex items-center gap-2">
                    {phase === "complete" ? (
                        <FiCheck className="w-5 h-5 text-[var(--color-accent)] shrink-0" aria-hidden />
                    ) : (
                        <FiLoader className="w-5 h-5 animate-spin text-[var(--color-accent)] shrink-0" aria-hidden />
                    )}
                    <h2 className="apex-parent-overlay__title">
                        {phase === "parent" && "Loading parent property"}
                        {phase === "properties" && `Fetching data (${loadedCount}/${totalCount})`}
                        {phase === "aggregating" && "Aggregating data"}
                        {phase === "complete" && "Complete"}
                    </h2>
                </div>

                {phase === "parent" ? (
                    <p className="apex-parent-overlay__text">
                        {parentName
                            ? `Fetching ${parentName} and child properties…`
                            : "Fetching parent and child list…"}
                    </p>
                ) : null}

                {(phase === "properties" || phase === "aggregating") && items.length > 0 ? (
                    <ul className="apex-parent-overlay__list">
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className={`apex-parent-overlay__item${item.status === "loaded" ? " is-done" : ""}`}
                            >
                                {item.status === "loading" ? (
                                    <>
                                        <FiLoader className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                                        <span>
                                            Fetching &quot;{item.name}&quot;
                                            {item.source ? ` from ${item.source}` : ""}
                                            {item.shop ? ` (${item.shop})` : ""}…
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <FiCheck className="w-4 h-4 text-[var(--color-accent)] shrink-0" aria-hidden />
                                        <span>
                                            Loaded: {item.name}
                                            {item.shop ? ` (${item.shop})` : ""}
                                        </span>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : null}

                {phase === "aggregating" ? (
                    <p className="apex-parent-overlay__text">Combining metrics and preparing charts…</p>
                ) : null}

                {phase === "complete" ? (
                    <p className="apex-parent-overlay__success">All data loaded successfully.</p>
                ) : null}

                {phase !== "complete" ? (
                    <div className="mt-4">
                        <CobaltLoader variant="inline" title="Streaming group metrics" />
                    </div>
                ) : null}
            </div>
        </div>
    );
}
