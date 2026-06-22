"use client";

import React, { useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { normalizeCampaignNameKeywords } from "@/lib/adCampaignFilterUtils";

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
        <div className="border-t border-[var(--color-rule)] pt-3 mt-3">
            <p className="apex-perf-modal__field-label mb-1">Exclude by campaign name keyword</p>
            <p className="apex-parent-empty-note mb-2">
                Any campaign whose name contains one of these words (not case-sensitive) is excluded
                from spend.
            </p>
            {list.length > 0 ? (
                <ul className="flex flex-wrap gap-2 mb-2">
                    {list.map((kw) => (
                        <li
                            key={kw.toLowerCase()}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-[var(--color-rule)] bg-[var(--perf-canvas)] text-[var(--color-ink-2)]"
                        >
                            <span>{kw}</span>
                            <button
                                type="button"
                                className="p-0.5 rounded hover:bg-[var(--color-paper-2)] disabled:opacity-50"
                                disabled={disabled}
                                onClick={() => removeKeyword(kw)}
                                aria-label={`Remove keyword ${kw}`}
                            >
                                <FiX className="w-3 h-3" />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            <div className="flex gap-2">
                <input
                    type="text"
                    className="apex-perf-modal__input flex-1"
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
                    className="apex-perf-btn"
                    disabled={disabled || !draft.trim()}
                    onClick={addKeyword}
                >
                    <FiPlus className="w-3.5 h-3.5" aria-hidden />
                    Add
                </button>
            </div>
        </div>
    );
}
