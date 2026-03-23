"use client";

import React from "react";
import { FiCheck, FiLoader } from "react-icons/fi";

/**
 * Loading overlay for parent-property view.
 * Shows progressive loading status: parent, each child property, aggregating, complete.
 * Fades out smoothly when done.
 *
 * @param {boolean} visible - Whether to show the overlay
 * @param {string} phase - 'parent' | 'properties' | 'aggregating' | 'complete'
 * @param {string} [parentName] - Parent property name (optional, for display)
 * @param {Array<{ id: string, name: string, status: 'loading' | 'loaded', source?: string, shop?: string }>} [items] - Child properties with loading status
 * @param {boolean} [fading] - True during fade-out animation
 */
export default function ParentPropertyLoadingOverlay({ visible, phase, parentName, items = [], fading = false }) {
    if (!visible) return null;

    const loadedCount = items.filter((i) => i.status === "loaded").length;
    const totalCount = items.length;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center glassmorphism2 transition-opacity duration-300 ${
                fading ? "opacity-0" : "opacity-100"
            }`}
        >
            <div className="w-full max-w-md p-6 md:p-8 bg-white border border-gray-200 rounded-xl shadow-xl">
                <div className="flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                        {phase === "complete" ? (
                            <FiCheck className="w-5 h-5 text-green-500 shrink-0" />
                        ) : (
                            <FiLoader className="w-5 h-5 animate-spin text-[var(--color-primary-searchmind)] shrink-0" />
                        )}
                        <h2 className="text-lg font-semibold text-gray-900">
                            {phase === "parent" && "Loading parent property..."}
                            {phase === "properties" && `Fetching data (${loadedCount}/${totalCount})`}
                            {phase === "aggregating" && "Aggregating data..."}
                            {phase === "complete" && "Complete"}
                        </h2>
                    </div>

                    {/* Phase: parent */}
                    {phase === "parent" && (
                        <p className="text-sm text-gray-500">
                            {parentName ? `Fetching ${parentName}...` : "Fetching parent and child list..."}
                        </p>
                    )}

                    {/* Phase: properties - progressive list */}
                    {(phase === "properties" || phase === "aggregating") && items.length > 0 && (
                        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {items.map((item) => (
                                <li key={item.id} className="flex items-center gap-2 text-sm text-gray-700 py-1">
                                    {item.status === "loading" ? (
                                        <>
                                            <FiLoader className="w-4 h-4 animate-spin text-[var(--color-primary-searchmind)] shrink-0" />
                                            <span className="italic">
                                                Fetching &quot;{item.name}&quot;
                                                {item.source ? ` from ${item.source}` : ""}
                                                {item.shop ? ` (${item.shop})` : ""}...
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <FiCheck className="w-4 h-4 text-green-500 shrink-0" />
                                            <span className="text-gray-600">
                                                Loaded: {item.name}
                                                {item.shop ? (
                                                    <span className="text-gray-400 ml-1">({item.shop})</span>
                                                ) : null}
                                            </span>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Phase: aggregating */}
                    {phase === "aggregating" && (
                        <p className="text-sm text-gray-500">Combining metrics and preparing charts...</p>
                    )}

                    {/* Phase: complete */}
                    {phase === "complete" && (
                        <p className="text-sm text-green-600">All data loaded successfully.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
