"use client";

import React from "react";
import FormLabel from "@/components/form/FormLabel";
import FormInputText from "@/components/form/FormInputText";
import FormButton from "@/components/form/FormButton";

export default function GeneralAppSettings() {
    const [form, setForm] = React.useState({ appName: "Searchmind Apex", theme: "light", timezone: "Europe/Copenhagen" });
    const [saving, setSaving] = React.useState(false);

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };
    const onSubmit = (e) => { e.preventDefault(); setSaving(true); setTimeout(() => setSaving(false), 500); };

    return (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">General App Settings</h5>
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
                <select id="theme" name="theme" value={form.theme} onChange={onChange} className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20">
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </div>
            <div className="w-full md:w-40">
                <FormButton>{saving ? "Saving..." : "Save"}</FormButton>
            </div>
        </form>
    );
}
