"use client";

import React from "react";
import FormLabel from "@/components/form/FormLabel";
import FormInputText from "@/components/form/FormInputText";

export default function GeneralAppSettings() {
    const [form, setForm] = React.useState({
        appName: "Searchmind Apex",
        theme: "light",
        timezone: "Europe/Copenhagen",
        gtmCode: "GTM-123123",
    });
    const [saving, setSaving] = React.useState(false);

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };
    const onSubmit = (e) => {
        e.preventDefault();
        setSaving(true);
        setTimeout(() => setSaving(false), 500);
    };

    return (
        <form className="apex-admin-form apex-admin-form--panel apex-admin-form--narrow" onSubmit={onSubmit}>
            <h2 className="apex-admin-section__title">General App Settings</h2>
            <div>
                <FormLabel htmlFor="appName" required>App Name</FormLabel>
                <FormInputText id="appName" name="appName" value={form.appName} onChange={onChange} required />
            </div>
            <div>
                <FormLabel htmlFor="timezone" required>Timezone</FormLabel>
                <FormInputText id="timezone" name="timezone" value={form.timezone} onChange={onChange} required />
            </div>
            <div>
                <FormLabel htmlFor="theme" required>Theme</FormLabel>
                <select id="theme" name="theme" value={form.theme} onChange={onChange}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </div>
            <div>
                <FormLabel htmlFor="gtmCode" required>GTM Code</FormLabel>
                <FormInputText id="gtmCode" name="gtmCode" value={form.gtmCode} onChange={onChange} required={false} />
            </div>
            <div className="apex-admin-actions">
                <button type="submit" className="apex-perf-btn apex-perf-btn--primary" disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                </button>
            </div>
        </form>
    );
}
