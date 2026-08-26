"use client";

import React from "react";

export default function PriceIndexScoreScale({ score }) {
    if (score == null || !Number.isFinite(score)) return null;

    const position = Math.min(100, Math.max(0, Number(score)));

    return (
        <div className="apex-ps-score-scale" aria-hidden>
            <div className="apex-ps-score-scale__track">
                <span
                    className="apex-ps-score-scale__marker"
                    style={{ left: `${position}%` }}
                >
                    <span className="apex-ps-score-scale__marker-dot" />
                </span>
            </div>
            <div className="apex-ps-score-scale__labels">
                <span>0</span>
                <span>100</span>
            </div>
        </div>
    );
}
