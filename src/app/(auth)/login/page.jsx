"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import "./login.css";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const errorParam = searchParams.get("error");
        if (errorParam) {
            if (errorParam === "AccessDenied") {
                setError("Only @searchmind.dk email addresses are allowed for Google SSO");
            } else {
                setError("Invalid email or password");
            }
        }
    }, [searchParams]);

    const handleGoogleSignIn = () => {
        setError("");
        signIn("google", { callbackUrl: "/home" });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        const result = await signIn("credentials", {
            redirect: false,
            email,
            password,
        });

        setIsSubmitting(false);

        if (result?.error) {
            setError("Invalid email or password");
        } else if (result?.ok) {
            router.push("/home");
        }
    };

    return (
        <div className="login-cobalt" data-theme="cobalt">
            <section className="login-cobalt__form-panel" aria-labelledby="login-heading">
                <div className="login-cobalt__form-inner">
                    <div className="login-cobalt__wordmark">
                        <Image
                            src="/images/icons/apex-icon-svg.svg"
                            alt=""
                            width={32}
                            height={32}
                            aria-hidden="true"
                        />
                        <span className="login-cobalt__wordmark-text">Searchmind Apex</span>
                    </div>

                    <p className="login-cobalt__eyebrow">Authentication</p>
                    <h1 id="login-heading" className="login-cobalt__headline">
                        Sign in to Apex
                    </h1>
                    <p className="login-cobalt__subhead">
                        Access campaign analytics, reporting, and performance data.
                    </p>

                    {error && (
                        <div className="login-cobalt__error" role="alert">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate>
                        <div className="login-cobalt__field">
                            <label htmlFor="email" className="login-cobalt__label">
                                Email
                                <span className="login-cobalt__label-required" aria-hidden="true">*</span>
                            </label>
                            <input
                                id="email"
                                type="email"
                                className="login-cobalt__input"
                                placeholder="you@searchmind.dk"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                aria-required="true"
                                aria-invalid={error ? "true" : undefined}
                            />
                        </div>

                        <div className="login-cobalt__field">
                            <label htmlFor="password" className="login-cobalt__label">
                                Password
                                <span className="login-cobalt__label-required" aria-hidden="true">*</span>
                            </label>
                            <input
                                id="password"
                                type="password"
                                className="login-cobalt__input"
                                placeholder="Your password"
                                required
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                aria-required="true"
                                aria-invalid={error ? "true" : undefined}
                            />
                        </div>

                        <button
                            type="submit"
                            className="login-cobalt__btn login-cobalt__btn--primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Signing in…" : "Sign in"}
                        </button>
                    </form>

                    <div className="login-cobalt__divider" aria-hidden="true">
                        <span className="login-cobalt__divider-text">Or</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="login-cobalt__btn login-cobalt__btn--secondary"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Continue with Google
                    </button>

                    <p className="login-cobalt__note">
                        Google SSO accepts <strong>searchmind.dk</strong> addresses only.
                    </p>
                </div>
            </section>

            <aside className="login-cobalt__brand-panel" aria-label="Product preview">
                <p className="login-cobalt__brand-eyebrow">Apex · Marketing ops</p>
                <p className="login-cobalt__brand-display">
                    One dashboard. Every channel.
                </p>
                <p className="login-cobalt__brand-copy">
                    Google Ads, Meta, analytics, and reporting — unified for your team.
                </p>

                <div className="login-cobalt__code-card">
                    <div className="login-cobalt__code-bar">
                        <div className="login-cobalt__code-dots" aria-hidden="true">
                            <span /><span /><span />
                        </div>
                        <span className="login-cobalt__code-filename">GET /api/customers</span>
                        <span className="login-cobalt__code-status">200 OK</span>
                    </div>
                    <pre className="login-cobalt__code-body"><code>{`{
  `}<span className="tok-key">&quot;status&quot;</span><span className="tok-punc">: </span><span className="tok-str">&quot;ok&quot;</span><span className="tok-punc">,</span>{`
  `}<span className="tok-key">&quot;customers&quot;</span><span className="tok-punc">: </span><span className="tok-num">42</span><span className="tok-punc">,</span>{`
  `}<span className="tok-key">&quot;channels&quot;</span><span className="tok-punc">: [</span><span className="tok-str">&quot;google&quot;</span><span className="tok-punc">, </span><span className="tok-str">&quot;meta&quot;</span><span className="tok-punc">]</span>{`
}`}</code></pre>
                </div>
            </aside>
        </div>
    );
}
