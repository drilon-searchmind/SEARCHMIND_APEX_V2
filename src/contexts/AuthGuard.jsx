"use client";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AuthVerifyingScreen from "@/components/auth/AuthVerifyingScreen";
import "@/components/auth/auth-verifying.css";

const EXIT_MS = 180;

export default function AuthGuard({ children }) {
	const { status } = useSession();
	const router = useRouter();
	const pathname = usePathname();
	const [showVerify, setShowVerify] = useState(() => status === "loading");
	const [exiting, setExiting] = useState(false);

	const isLanding = pathname === "/";
	const isLogin = pathname === "/login";
	const isPreview = pathname?.startsWith("/preview/");
	const isOnboarding = pathname?.startsWith("/onboarding/");
	const isPublicRoute = isLanding || isLogin || isPreview || isOnboarding;

	useEffect(() => {
		if (status === "unauthenticated" && !isPublicRoute) {
			router.push("/login");
		}
		if (status === "authenticated" && (isLanding || isLogin)) {
			router.push("/home");
		}
	}, [status, router, pathname, isLanding, isLogin, isPublicRoute]);

	useEffect(() => {
		if ((isLanding || isPreview || isOnboarding) && status !== "authenticated") {
			setShowVerify(false);
			setExiting(false);
			return undefined;
		}

		if (status === "loading") {
			setShowVerify(true);
			setExiting(false);
			return undefined;
		}

		if (showVerify && status === "authenticated") {
			setExiting(true);
			const timer = window.setTimeout(() => {
				setShowVerify(false);
				setExiting(false);
			}, EXIT_MS);
			return () => window.clearTimeout(timer);
		}

		if (status === "unauthenticated") {
			setShowVerify(false);
			setExiting(false);
		}

		return undefined;
	}, [status, isLanding, isPreview, isOnboarding, showVerify]);

	if (isPreview || isOnboarding) {
		return children;
	}

	if (isLanding && status !== "authenticated") {
		return children;
	}

	if (isLanding && status === "authenticated") {
		return null;
	}

	if (showVerify) {
		return <AuthVerifyingScreen exiting={exiting} />;
	}

	if (status === "unauthenticated" && isLogin) {
		return children;
	}

	if (status === "authenticated") {
		return <div className="auth-guard-enter">{children}</div>;
	}

	return null;
}
