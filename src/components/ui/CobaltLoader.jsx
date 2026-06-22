"use client";

import React, { useEffect, useState } from "react";
import "./cobalt-loader.css";

const DEFAULT_STEPS = ["Initialize request", "Fetch data", "Process results"];

function LoaderCodeCard({ request, status }) {
    return (
        <div className="apex-loader__code-card">
            <div className="apex-loader__code-bar">
                <div className="apex-loader__code-dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                </div>
                <span className="apex-loader__code-filename">{request}</span>
                <span className="apex-loader__code-status">{status}</span>
            </div>
            <pre className="apex-loader__code-body">
                <code>{`{\n  `}</code>
                <span className="apex-loader__tok-key">&quot;status&quot;</span>
                <code>
                    <span className="apex-loader__tok-punc">: </span>
                </code>
                <span className="apex-loader__tok-str">&quot;pending&quot;</span>
                <code>
                    <span className="apex-loader__tok-punc">,</span>
                    {"\n  "}
                </code>
                <span className="apex-loader__tok-key">&quot;payload&quot;</span>
                <code>
                    <span className="apex-loader__tok-punc">: </span>
                </code>
                <span className="apex-loader__shimmer apex-loader__shimmer--short" />
                <code>
                    <span className="apex-loader__tok-punc">,</span>
                    {"\n  "}
                </code>
                <span className="apex-loader__tok-key">&quot;metrics&quot;</span>
                <code>
                    <span className="apex-loader__tok-punc">: </span>
                </code>
                <span className="apex-loader__shimmer" />
                <code>{"\n}"}</code>
            </pre>
        </div>
    );
}

/**
 * Cobalt-themed loading indicator (auth-verify pattern).
 * @param {"panel"|"block"|"inline"} [variant="panel"] — panel: steps + copy; block: compact; inline: code card only
 */
export default function CobaltLoader({
    eyebrow,
    title = "Loading",
    subtitle,
    steps = DEFAULT_STEPS,
    request = "GET /api/data",
    statusLabel,
    stepIntervalMs = 900,
    variant = "panel",
    className = "",
    theme = "cobalt",
    "aria-label": ariaLabel,
}) {
    const [activeStep, setActiveStep] = useState(0);
    const showSteps = variant === "panel" && steps?.length > 0;
    const showCopy = variant !== "inline" && (eyebrow || title || subtitle);
    const status =
        statusLabel ??
        (showSteps && steps[activeStep] ? steps[activeStep] : "loading");

    useEffect(() => {
        if (!showSteps || steps.length <= 1) return undefined;

        const interval = window.setInterval(() => {
            setActiveStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
        }, stepIntervalMs);

        return () => window.clearInterval(interval);
    }, [showSteps, steps, stepIntervalMs]);

    return (
        <div
            className={`apex-loader apex-loader--${variant}${className ? ` ${className}` : ""}`}
            data-theme={theme}
            role="status"
            aria-live="polite"
            aria-label={ariaLabel ?? title}
        >
            <div className="apex-loader__progress" aria-hidden>
                <div className="apex-loader__progress-bar" />
            </div>

            {showCopy && (
                <div className="apex-loader__copy">
                    {eyebrow ? <p className="apex-loader__eyebrow">{eyebrow}</p> : null}
                    {title ? <p className="apex-loader__title">{title}</p> : null}
                    {subtitle && variant === "panel" ? (
                        <p className="apex-loader__subtitle">{subtitle}</p>
                    ) : null}
                </div>
            )}

            {showSteps ? (
                <ol className="apex-loader__steps">
                    {steps.map((step, index) => {
                        const isActive = index === activeStep;
                        const isDone = index < activeStep;
                        return (
                            <li
                                key={step}
                                className={`apex-loader__step${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}
                            >
                                <span className="apex-loader__step-dot" aria-hidden />
                                <span className="apex-loader__step-text">{step}</span>
                                {isDone ? (
                                    <span className="apex-loader__step-check" aria-hidden>
                                        ✓
                                    </span>
                                ) : null}
                            </li>
                        );
                    })}
                </ol>
            ) : null}

            <LoaderCodeCard request={request} status={status} />
        </div>
    );
}
