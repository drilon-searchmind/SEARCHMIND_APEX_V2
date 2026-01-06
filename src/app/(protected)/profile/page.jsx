"use client";

import React, { useMemo, useState, useEffect } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import { useUser } from "@/contexts/UserContext";
import ProfileForm from "./components/ProfileForm";
import SharedCustomersCard from "./components/SharedCustomersCard";

export default function ProfilePage() {
    const sessionUser = useUser();

    const initialForm = useMemo(() => ({
        name: sessionUser?.name || "",
        email: sessionUser?.email || "",
        password: "",
        image: sessionUser?.image || "",
        createdAt: sessionUser?.createdAt ? new Date(sessionUser.createdAt).toLocaleString() : "",
    }), [sessionUser]);

    const [form, setForm] = useState(initialForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm(initialForm);
    }, [initialForm]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setSaving(true);
        // TODO: Wire up API call to save user profile
        setTimeout(() => setSaving(false), 600);
    };

    const sharedCustomers = Array.isArray(sessionUser?.sharedCustomers) ? sessionUser.sharedCustomers : [];

    return (
        <div className="w-full">
            <DashboardHeading title="Profile" label={form.name || "My Profile"} right={null} />

            {/* Editable profile form (User schema fields only) */}
            <ProfileForm form={form} onChange={handleChange} onSubmit={handleSubmit} saving={saving} />

            {/* Read-only shared customers */}
            <SharedCustomersCard sharedCustomers={sharedCustomers} />
        </div>
    );
}