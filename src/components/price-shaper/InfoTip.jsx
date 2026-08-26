"use client";

import React from "react";
import { FiHelpCircle } from "react-icons/fi";
import { Tooltip } from "@/components/ui/Tooltip";

export default function InfoTip({ text, label = "More information" }) {
    if (!text) return null;

    return (
        <Tooltip content={text}>
            <button
                type="button"
                className="apex-ps-info-tip"
                aria-label={label}
            >
                <FiHelpCircle aria-hidden />
            </button>
        </Tooltip>
    );
}
