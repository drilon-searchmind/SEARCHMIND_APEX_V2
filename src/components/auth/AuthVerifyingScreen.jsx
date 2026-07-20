"use client";

import Image from "next/image";
import "./auth-verifying.css";

export default function AuthVerifyingScreen({ exiting = false }) {
    return (
        <div
            className={`apex-auth-check${exiting ? " is-exiting" : ""}`}
            role="status"
            aria-live="polite"
            aria-label="Checking session"
        >
            <div className="apex-auth-check__inner">
                <Image
                    src="/images/icons/apex-icon-svg.svg"
                    alt=""
                    width={36}
                    height={36}
                    className="apex-auth-check__logo"
                    aria-hidden
                />
                <div className="apex-auth-check__spinner" aria-hidden />
                <p className="apex-auth-check__text">Checking session…</p>
            </div>
        </div>
    );
}
