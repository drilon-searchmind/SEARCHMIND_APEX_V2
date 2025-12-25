"use client";

import FormInputPassword from "@/components/form/FormInputPassword";
import FormInputText from "@/components/form/FormInputText";
import FormButton from "@/components/form/FormButton";
import FormLabel from "@/components/form/FormLabel";
import Image from "next/image";
import CustomerTable from "@/components/table/CustomerTable";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import ErrorMessage from "@/components/ui/ErrorMessage";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();
    const { status } = useSession();

    // Show error from NextAuth (e.g. ?error=CredentialsSignin)
    useEffect(() => {
        const errorParam = searchParams.get("error");
        if (errorParam) {
            setError("Invalid email or password");
        }
    }, [searchParams]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        const result = await signIn("credentials", {
            redirect: false,
            email,
            password,
        });
        if (result?.error) {
            setError("Invalid email or password");
        } else if (result?.ok) {
            router.push("/home");
        }
    };

    return (
        <div className="flex h-screen lg:flex-row flex-col">
            {/* Left Section */}
            <div className="flex-1 flex items-center justify-center bg-white">
                <div className="w-full max-w-md p-8">
                    <h1 className="text-3xl font-bold mb-4">Sign In</h1>
                    <p className="text-gray-400 mb-6">Enter your email and password to sign in!</p>

                    <ErrorMessage message={error} />

                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <FormLabel htmlFor="email" required={true}>Email</FormLabel>
                            <FormInputText
                                id="email"
                                placeholder="Enter your email"
                                required={true}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="mb-6">
                            <FormLabel htmlFor="password" required={true}>Password</FormLabel>
                            <FormInputPassword
                                id="password"
                                placeholder="Enter your password"
                                required={true}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        <FormButton type="submit">Sign In</FormButton>
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
                        src="/images/icons/apexlogo-new1.png"
                        alt="Apex Icon"
                        width={200}
                        height={200}
                        className="mb-2 filter invert"
                    />
                    <p className="text-lg text-gray-300 max-w-lg mt-5">
                        Streamline your marketing performance with comprehensive analytics, campaign management, and data visualization tools. Make data-driven decisions with confidence.
                    </p>
                </div>
            </div>
        </div>
    );
}