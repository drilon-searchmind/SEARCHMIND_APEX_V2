"use client";

import React from "react";
import Image from "next/image";
import FormLabel from "@/components/form/FormLabel";
import FormInputText from "@/components/form/FormInputText";
import FormInputPassword from "@/components/form/FormInputPassword";
import FormButton from "@/components/form/FormButton";

export default function ProfileForm({ form, onChange, onSubmit, saving }) {
    return (
        <form className="bg-white rounded-xl border border-gray-200 p-6 mb-8" onSubmit={onSubmit}>
            <h3 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-4">Profile</h3>

            {/* Avatar + Image URL */}
            <div className="flex items-center gap-4 mb-6 w-full">
                <span className="flex flex-col w-full">
                    <div className="h-16 w-16 rounded-full overflow-hidden border border-gray-200 bg-gray-50">
                        <Image
                            src={form.image || "/images/users/default-avatar-photo-placeholder-profile-icon-vector.jpg"}
                            alt="Avatar"
                            width={64}
                            height={64}
                            className="object-cover h-full w-full"
                        />
                    </div>
                    <div className="flex-1 mt-4 w-full">
                        <FormLabel htmlFor="image">Image URL</FormLabel>
                        <FormInputText id="image" name="image" value={form.image} onChange={onChange} placeholder="https://..." />
                    </div>
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <FormLabel htmlFor="name" required>Name</FormLabel>
                    <FormInputText id="name" name="name" value={form.name} onChange={onChange} required />
                </div>
                <div>
                    <FormLabel htmlFor="email" required>Email</FormLabel>
                    <FormInputText id="email" name="email" type="email" value={form.email} onChange={onChange} required />
                </div>
                <div>
                    <FormLabel htmlFor="password">Password</FormLabel>
                    <FormInputPassword id="password" name="password" value={form.password} onChange={onChange} placeholder="••••••••" required={false} />
                    <p className="text-xs text-gray-400 mt-1">Leave blank to keep current password.</p>
                </div>
            </div>

            <div className="mt-6 flex justify-end">
                <div className="w-full md:w-auto md:min-w-40">
                    <FormButton>{saving ? "Saving..." : "Save Changes"}</FormButton>
                </div>
            </div>
        </form>
    );
}
