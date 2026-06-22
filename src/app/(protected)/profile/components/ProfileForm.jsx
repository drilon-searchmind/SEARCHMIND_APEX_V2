"use client";

import React from "react";
import Image from "next/image";
import FormLabel from "@/components/form/FormLabel";
import FormInputText from "@/components/form/FormInputText";
import FormInputPassword from "@/components/form/FormInputPassword";

export default function ProfileForm({ form, onChange, onSubmit, saving }) {
    return (
        <form className="apex-profile-card apex-profile-form" onSubmit={onSubmit}>
            <h2 className="apex-profile-card__title">Account</h2>
            {form.createdAt ? (
                <p className="apex-profile-meta">
                    Member since <strong>{form.createdAt}</strong>
                </p>
            ) : null}

            <div className="apex-profile-hero">
                <div className="apex-profile-avatar">
                    <Image
                        src={form.image || "/images/users/default-avatar-photo-placeholder-profile-icon-vector.jpg"}
                        alt="Avatar"
                        width={72}
                        height={72}
                    />
                </div>
                <div className="apex-profile-hero__fields">
                    <FormLabel htmlFor="image">Image URL</FormLabel>
                    <FormInputText
                        id="image"
                        name="image"
                        value={form.image}
                        onChange={onChange}
                        placeholder="https://..."
                    />
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
                <div>
                    <FormLabel htmlFor="password">Password</FormLabel>
                    <FormInputPassword
                        id="password"
                        name="password"
                        value={form.password}
                        onChange={onChange}
                        placeholder="••••••••"
                        required={false}
                    />
                    <p className="apex-profile-field-hint">Leave blank to keep current password.</p>
                </div>
            </div>

            <div className="apex-profile-actions">
                <button
                    type="submit"
                    className="apex-perf-btn apex-perf-btn--primary"
                    disabled={saving}
                >
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>
        </form>
    );
}
