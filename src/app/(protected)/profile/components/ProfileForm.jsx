"use client";

import React, { useMemo } from "react";
import FormLabel from "@/components/form/FormLabel";
import FormInputText from "@/components/form/FormInputText";
import FormInputPassword from "@/components/form/FormInputPassword";
import { ProfileAvatar } from "./ProfileSummary";

function passwordStrength(pw) {
    if (!pw) return null;
    let score = 0;
    if (pw.length >= 8) score += 1;
    if (pw.length >= 12) score += 1;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
    if (score <= 1) return { level: 1, label: "Weak" };
    if (score === 2) return { level: 2, label: "Okay" };
    if (score === 3) return { level: 3, label: "Good" };
    return { level: 4, label: "Strong" };
}

export function SaveBar({ dirty, saving, onReset, label = "Save changes" }) {
    return (
        <div className={`apex-profile-actions${dirty ? " is-dirty" : ""}`}>
            <span className="apex-profile-actions__note" role="status">
                {dirty ? "You have unsaved changes" : "All changes saved"}
            </span>
            <button
                type="button"
                className="apex-profile-btn-text"
                onClick={onReset}
                disabled={!dirty || saving}
            >
                Discard
            </button>
            <button type="submit" className="apex-perf-btn apex-perf-btn--primary" disabled={!dirty || saving}>
                {saving ? "Saving..." : label}
            </button>
        </div>
    );
}

export default function ProfileForm({ form, onChange, onSubmit, onReset, saving, dirty }) {
    const strength = useMemo(() => passwordStrength(form.password), [form.password]);

    return (
        <form className="apex-profile-card apex-profile-form apex-profile-reveal" onSubmit={onSubmit}>
            <header className="apex-profile-card__head">
                <h2 className="apex-profile-card__title">Personal details</h2>
                <p className="apex-profile-card__subtitle">How you appear to colleagues across Apex.</p>
            </header>

            <div className="apex-profile-hero">
                <ProfileAvatar image={form.image} name={form.name} email={form.email} size="md" />
                <div className="apex-profile-hero__fields">
                    <FormLabel htmlFor="image">Profile picture URL</FormLabel>
                    <FormInputText
                        id="image"
                        name="image"
                        value={form.image}
                        onChange={onChange}
                        placeholder="https://..."
                    />
                    <p className="apex-profile-field-hint">Paste a link to an image. The preview updates as you type.</p>
                </div>
            </div>

            <div className="apex-profile-grid">
                <div>
                    <FormLabel htmlFor="name" required>Name</FormLabel>
                    <FormInputText id="name" name="name" value={form.name} onChange={onChange} required />
                </div>
                <div>
                    <FormLabel htmlFor="email" required>Email</FormLabel>
                    <FormInputText
                        id="email"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={onChange}
                        required
                    />
                </div>
            </div>

            <div className="apex-profile-divider" />

            <header className="apex-profile-card__head">
                <h3 className="apex-profile-card__title apex-profile-card__title--sm">Security</h3>
            </header>
            <div className="apex-profile-grid">
                <div>
                    <FormLabel htmlFor="password">New password</FormLabel>
                    <FormInputPassword
                        id="password"
                        name="password"
                        value={form.password}
                        onChange={onChange}
                        placeholder="Leave blank to keep current"
                        required={false}
                    />
                    {strength ? (
                        <div className="apex-profile-strength" data-level={strength.level}>
                            <span className="apex-profile-strength__bar" aria-hidden="true">
                                <i /><i /><i /><i />
                            </span>
                            <span className="apex-profile-strength__label">{strength.label}</span>
                        </div>
                    ) : (
                        <p className="apex-profile-field-hint">Use 12 or more characters with mixed case, numbers and symbols.</p>
                    )}
                </div>
            </div>

            <SaveBar dirty={dirty} saving={saving} onReset={onReset} />
        </form>
    );
}
