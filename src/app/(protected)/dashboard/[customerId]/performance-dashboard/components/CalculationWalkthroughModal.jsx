"use client";

import React, { useEffect, useMemo } from "react";
import { FiX, FiArrowRight } from "react-icons/fi";
import { buildCalculationWalkthroughSteps } from "@/lib/performanceDashboard/buildCalculationWalkthroughSteps";

function WalkthroughStepCard({ step, isLast }) {
    const isMilestone = step.kind === "milestone";
    const isFinal = step.isFinal;

    return (
        <li
            className={`apex-perf-walk__step${isMilestone ? " is-milestone" : ""}${step.isNested ? " is-nested" : ""}${isFinal ? " is-destination" : ""}`}
        >
            <div className="apex-perf-walk__rail" aria-hidden="true">
                <span className="apex-perf-walk__number">
                    {String(step.number).padStart(2, "0")}
                </span>
                {!isLast && <span className="apex-perf-walk__rail-line" />}
            </div>

            <article className="apex-perf-walk__card">
                <header className="apex-perf-walk__card-head">
                    <span className="apex-perf-walk__phase">{step.phase}</span>
                    <div className="apex-perf-walk__card-title-row">
                        <h3 className="apex-perf-walk__card-title">{step.label}</h3>
                        {step.value != null && step.value !== "" && (
                            <span className="apex-perf-walk__card-value">{step.value}</span>
                        )}
                    </div>
                    {step.formula && (
                        <p className="apex-perf-walk__formula">{step.formula}</p>
                    )}
                </header>

                {step.inputs?.length > 0 && (
                    <dl className="apex-perf-walk__inputs">
                        {step.inputs.map(({ key, value }, i) => (
                            <div key={`${key}-${i}`} className="apex-perf-walk__input-row">
                                <dt>{key}</dt>
                                <dd>{value}</dd>
                            </div>
                        ))}
                    </dl>
                )}

                {step.calcLines?.length > 0 && (
                    <div className="apex-perf-walk__calc">
                        {step.calcLines.map((line, i) => (
                            <div
                                key={i}
                                className={`apex-perf-walk__calc-line${
                                    i === step.calcLines.length - 1 ? " is-result" : ""
                                }`}
                            >
                                {line}
                            </div>
                        ))}
                    </div>
                )}

                {step.notes?.length > 0 && (
                    <div className="apex-perf-walk__note">
                        {step.notes.map((note, i) => (
                            <p key={i}>{note.replace(/^Note:\s*/i, "")}</p>
                        ))}
                    </div>
                )}
            </article>
        </li>
    );
}

export default function CalculationWalkthroughModal({
    open,
    onClose,
    sections = [],
    metrics = [],
    title = "From revenue to net profit",
    subtitle = "Follow each step to see how we move from top-line revenue to your final net profit for this period.",
    dateLabel = null,
}) {
    const { steps, milestones } = useMemo(
        () => buildCalculationWalkthroughSteps(sections, metrics),
        [sections, metrics]
    );

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    const detailCount = steps.filter((s) => s.kind === "detail").length;

    return (
        <div
            className="apex-perf-modal-scrim"
            role="presentation"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="apex-perf-modal apex-perf-modal--wide apex-perf-modal--scroll apex-perf-modal--walkthrough"
                role="dialog"
                aria-modal="true"
                aria-labelledby="calc-walkthrough-title"
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="apex-perf-modal__close"
                    aria-label="Close"
                >
                    <FiX className="text-xl" />
                </button>

                <header className="apex-perf-walk__header">
                    <p className="apex-perf-walk__eyebrow">Calculation walkthrough</p>
                    <h2 id="calc-walkthrough-title" className="apex-perf-modal__title">
                        {title}
                    </h2>
                    <p className="apex-perf-modal__lede mb-0">
                        {subtitle}
                        {dateLabel ? (
                            <>
                                {" "}
                                <span className="apex-perf-walk__date">{dateLabel}</span>
                            </>
                        ) : null}
                    </p>
                </header>

                {milestones.length > 0 && (
                    <div className="apex-perf-walk__summary" aria-label="Key milestones">
                        {milestones.map((m, i) => (
                            <React.Fragment key={m.key}>
                                <div
                                    className={`apex-perf-walk__summary-node${
                                        i === milestones.length - 1 ? " is-destination" : ""
                                    }`}
                                >
                                    <span className="apex-perf-walk__summary-label">{m.label}</span>
                                    <span className="apex-perf-walk__summary-value">{m.value}</span>
                                </div>
                                {i < milestones.length - 1 && (
                                    <FiArrowRight
                                        className="apex-perf-walk__summary-arrow"
                                        aria-hidden
                                    />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                <div className="apex-perf-modal__body apex-perf-walk__body">
                    {steps.length === 0 ? (
                        <p className="text-sm text-[var(--color-muted)]">
                            No calculation details are available for this view yet.
                        </p>
                    ) : (
                        <>
                            <p className="apex-perf-walk__meta">
                                {steps.length} steps
                                {detailCount > 0
                                    ? ` · ${detailCount} component calculations`
                                    : ""}
                            </p>
                            <ol className="apex-perf-walk__timeline">
                                {steps.map((step, i) => (
                                    <WalkthroughStepCard
                                        key={`${step.key}-${step.number}`}
                                        step={step}
                                        isLast={i === steps.length - 1}
                                    />
                                ))}
                            </ol>
                        </>
                    )}
                </div>

                <div className="apex-perf-modal__footer">
                    <div className="apex-perf-modal__actions mt-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="apex-perf-btn apex-perf-btn--primary"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
