"use client";

import FormInputPassword from "@/components/form/FormInputPassword";
import FormInputText from "@/components/form/FormInputText";
import FormButton from "@/components/form/FormButton";
import FormLabel from "@/components/form/FormLabel";
import Image from "next/image";
import CustomerTable from "@/components/table/CustomerTable";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import ErrorMessage from "@/components/ui/ErrorMessage";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();

    // Show error from NextAuth (e.g. ?error=CredentialsSignin)
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


    // Handle Google SSO login
    const handleGoogleSignIn = () => {
        setError("");
        signIn("google", { callbackUrl: "/home" });
    };

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

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or continue with</span>
                        </div>
                    </div>

                    {/* Google Sign In Button */}
                    <button
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors font-medium text-gray-700"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                        <span>Sign in with Google</span>
                    </button>

                    <p className="text-xs text-gray-500 mt-4 text-center">Note: Only accepts <b className="text-gray-700">searchmind.dk</b> email addresses for Google SSO</p>
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