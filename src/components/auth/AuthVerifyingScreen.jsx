"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import "./auth-verifying.css";

const STEPS = [
    "Verify session token",
    "Load user profile",
    "Open workspace",
];

const STEP_MS = 900;

export default function AuthVerifyingScreen({ phase = "verifying" }) {
    const [activeStep, setActiveStep] = useState(0);
    const isSuccess = phase === "success";
    const isExiting = phase === "exiting";

    useEffect(() => {
        if (phase !== "verifying") return undefined;

        const interval = window.setInterval(() => {
            setActiveStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
        }, STEP_MS);

        return () => window.clearInterval(interval);
    }, [phase]);

    useEffect(() => {
        if (phase === "success") {
            setActiveStep(STEPS.length - 1);
        }
    }, [phase]);

    const displayStep = isSuccess ? STEPS.length - 1 : activeStep;
    const statusLabel = isSuccess ? "200 OK" : STEPS[displayStep];
    const jsonStatus = isSuccess ? "ok" : "pending";

    return (
        <div
            className={`auth-verify${isSuccess ? " is-success" : ""}${isExiting ? " is-exiting" : ""}`}
            data-theme="cobalt"
            role="status"
            aria-live="polite"
            aria-label={isSuccess ? "Authentication verified" : "Verifying authentication"}
        >
            <div className="auth-verify__progress" aria-hidden>
                <div
                    className={`auth-verify__progress-bar${isSuccess ? " is-complete" : ""}`}
                />
            </div>

            <section className="auth-verify__panel auth-verify__reveal" aria-labelledby="auth-verify-heading">
                <div className="auth-verify__inner">
                    <div className="auth-verify__wordmark auth-verify__reveal auth-verify__reveal--1">
                        <Image
                            src="/images/icons/apex-icon-svg.svg"
                            alt=""
                            width={32}
                            height={32}
                            aria-hidden
                        />
                        <span className="auth-verify__wordmark-text">Searchmind Apex</span>
                    </div>

                    <p className="auth-verify__eyebrow auth-verify__reveal auth-verify__reveal--2">Authentication</p>
                    <h1 id="auth-verify-heading" className="auth-verify__headline auth-verify__reveal auth-verify__reveal--3">
                        {isSuccess ? "Session verified" : "Verifying session"}
                    </h1>
                    <p className="auth-verify__subhead auth-verify__reveal auth-verify__reveal--4">
                        {isSuccess
                            ? "You're signed in. Opening your workspace now."
                            : "Confirming your credentials and preparing your workspace."}
                    </p>

                    <ol className="auth-verify__steps auth-verify__reveal auth-verify__reveal--5">
                        {STEPS.map((step, index) => {
                            const isActive = !isSuccess && index === activeStep;
                            const isDone = isSuccess || index < activeStep;
                            return (
                                <li
                                    key={step}
                                    className={`auth-verify__step${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}
                                >
                                    <span className="auth-verify__step-dot" aria-hidden />
                                    <span className="auth-verify__step-text">{step}</span>
                                    {isDone && (
                                        <span className="auth-verify__step-check" aria-hidden>
                                            ✓
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </section>

            <aside className="auth-verify__brand auth-verify__reveal auth-verify__reveal--2" aria-label="Session status">
                <p className="auth-verify__brand-eyebrow">Apex · Session</p>
                <p className="auth-verify__brand-display">
                    {isSuccess ? "Welcome back." : "Almost there."}
                </p>
                <p className="auth-verify__brand-copy">
                    {isSuccess
                        ? "Authentication passed. Loading properties and dashboards."
                        : "Validating your sign-in before loading campaigns, reports, and property data."}
                </p>

                <div className="auth-verify__code-card">
                    <div className="auth-verify__code-bar">
                        <div className="auth-verify__code-dots" aria-hidden>
                            <span />
                            <span />
                            <span />
                        </div>
                        <span className="auth-verify__code-filename">POST /api/auth/session</span>
                        <span
                            key={statusLabel}
                            className={`auth-verify__code-status${isSuccess ? " is-ok" : " is-pending"}`}
                        >
                            {statusLabel}
                        </span>
                    </div>
                    <pre className="auth-verify__code-body">
                        <code>{`{
  `}</code>
                        <span className="auth-verify__tok-key">&quot;status&quot;</span>
                        <code>
                            <span className="auth-verify__tok-punc">: </span>
                        </code>
                        <span
                            key={jsonStatus}
                            className={isSuccess ? "auth-verify__tok-str auth-verify__tok-str--ok" : "auth-verify__tok-str"}
                        >
                            &quot;{jsonStatus}&quot;
                        </span>
                        <code>
                            <span className="auth-verify__tok-punc">,</span>
                            {"\n  "}
                        </code>
                        <span className="auth-verify__tok-key">&quot;user&quot;</span>
                        <code>
                            <span className="auth-verify__tok-punc">: </span>
                        </code>
                        {isSuccess ? (
                            <span className="auth-verify__tok-str">&quot;authenticated&quot;</span>
                        ) : (
                            <span className="auth-verify__shimmer auth-verify__shimmer--short" />
                        )}
                        <code>
                            <span className="auth-verify__tok-punc">,</span>
                            {"\n  "}
                        </code>
                        <span className="auth-verify__tok-key">&quot;workspace&quot;</span>
                        <code>
                            <span className="auth-verify__tok-punc">: </span>
                        </code>
                        {isSuccess ? (
                            <span className="auth-verify__tok-str">&quot;ready&quot;</span>
                        ) : (
                            <span className="auth-verify__shimmer" />
                        )}
                        <code>{"\n}"}</code>
                    </pre>
                </div>
            </aside>
        </div>
    );
}
