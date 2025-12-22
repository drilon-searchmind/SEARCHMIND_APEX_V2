"use client";

import FormInputPassword from "@/components/form/FormInputPassword";
import FormInputText from "@/components/form/FormInputText";
import FormButton from "@/components/form/FormButton";
import FormLabel from "@/components/form/FormLabel";
import Image from "next/image";
import CustomerTable from "@/components/table/CustomerTable";
import { useState } from "react";

export default function LoginPage() {
    return (
        <div className="flex h-screen lg:flex-row flex-col">
            {/* Left Section */}
            <div className="flex-1 flex items-center justify-center bg-white">
                <div className="w-full max-w-md p-8">
                    <h1 className="text-3xl font-bold mb-4">Sign In</h1>
                    <p className="text-gray-400 mb-6">Enter your email and password to sign in!</p>

                    <form>
                        <div className="mb-4">
                            <FormLabel htmlFor="email" required={true}>Email</FormLabel>
                            <FormInputText placeholder="Enter your email" required={true} />
                        </div>

                        <div className="mb-6">
                            <FormLabel htmlFor="password" required={true}>Password</FormLabel>
                            <FormInputPassword placeholder="Enter your password" required={true} />
                        </div>

                        <FormButton>Sign In</FormButton>
                    </form>
                </div>
            </div>

            {/* Right Section */}
            <div className="relative flex-1 flex items-center justify-center bg-[var(--color-primary-searchmind-lighter)] text-white">
                {/* Background image overlay */}
                <div className="absolute inset-0">
                    <Image
                        src="/images/overlays/26305.jpg"
                        alt="Background overlay"
                        layout="fill"
                        objectFit="cover"
                        className="opacity-40"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[var(--color-primary-searchmind-lighter)]"></div>
                </div>

                {/* Text content */}
                <div className="relative text-left">
                    <Image
                        src="/images/icons/apex-icon.svg"
                        alt="Apex Icon"
                        width={30}
                        height={30}
                        className="mb-2"
                    />
                    <h1 className="text-4xl font-bold mb-0 tracking-[0.75rem] uppercase">Apex</h1>
                    <p className="text-lg text-gray-300 max-w-lg mt-5">
                        Streamline your marketing performance with comprehensive analytics, campaign management, and data visualization tools. Make data-driven decisions with confidence.
                    </p>
                </div>
            </div>
        </div >
    );
}