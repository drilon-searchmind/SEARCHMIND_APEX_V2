"use client";

import React, { useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { normalizeCampaignNameKeywords } from "@/lib/adCampaignFilterUtils";

/**
 * Add/remove name keywords — campaigns whose name contains any keyword (case-insensitive) are excluded.
 */
export default function CampaignExclusionKeywordEditor({
    keywords = [],
    onChange,
    disabled = false,
    placeholder = 'e.g. "retail"',
}) {
    const [draft, setDraft] = useState("");
    const list = normalizeCampaignNameKeywords(keywords);

    const addKeyword = () => {
        const k = draft.trim();
        if (!k) return;
        const next = normalizeCampaignNameKeywords([...list, k]);
        onChange?.(next);
        setDraft("");
    };

    const removeKeyword = (keyword) => {
        const key = keyword.toLowerCase();
        onChange?.(list.filter((k) => k.toLowerCase() !== key));
    };

    return (
        <div className="border-t border-gray-100 pt-3 mt-3">
            <p className="text-xs font-medium text-gray-700 mb-1">
                Exclude by campaign name keyword
            </p>
            <p className="text-xs text-gray-500 mb-2">
                Any campaign whose name contains one of these words (not case-sensitive) is
                excluded from spend.
            </p>
            {list.length > 0 && (
                <ul className="flex flex-wrap gap-2 mb-2">
                    {list.map((kw) => (
                        <li
                            key={kw.toLowerCase()}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 text-xs border border-amber-200"
                        >
                            <span>{kw}</span>
                            <button
                                type="button"
                                className="p-0.5 rounded hover:bg-amber-100 disabled:opacity-50"
                                disabled={disabled}
                                onClick={() => removeKeyword(kw)}
                                aria-label={`Remove keyword ${kw}`}
                            >
                                <FiX className="w-3 h-3" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex gap-2">
                <input
                    type="text"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]"
                    placeholder={placeholder}
                    value={draft}
                    disabled={disabled}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            addKeyword();
                        }
                    }}
                />
                <button
                    type="button"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                    disabled={disabled || !draft.trim()}
                    onClick={addKeyword}
                >
                    <FiPlus className="w-3.5 h-3.5" />
                    Add
                </button>
            </div>
        </div>
    );
}
