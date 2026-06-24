"use client";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AuthVerifyingScreen from "@/components/auth/AuthVerifyingScreen";
import "@/components/auth/auth-verifying.css";

const MIN_VERIFY_MS = 2800;
const SUCCESS_HOLD_MS = 750;
const EXIT_MS = 600;

export default function AuthGuard({ children }) {
	const { status } = useSession();
	const router = useRouter();
	const pathname = usePathname();
	const [showVerify, setShowVerify] = useState(() => status === "loading");
	const [verifyPhase, setVerifyPhase] = useState("verifying");
	const startedAt = useRef(null);
	const timers = useRef([]);

	const clearTimers = () => {
		timers.current.forEach((id) => window.clearTimeout(id));
		timers.current = [];
	};

	const schedule = (fn, delay) => {
		const id = window.setTimeout(fn, delay);
		timers.current.push(id);
	};

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
		clearTimers();

		if ((isLanding || isPreview || isOnboarding) && status !== "authenticated") {
			setShowVerify(false);
			startedAt.current = null;
			return undefined;
		}

		if (status === "loading") {
			startedAt.current = Date.now();
			setShowVerify(true);
			setVerifyPhase("verifying");
			return undefined;
		}

		if (startedAt.current === null) {
			setShowVerify(false);
			return undefined;
		}

		const elapsed = Date.now() - startedAt.current;
		const wait = Math.max(0, MIN_VERIFY_MS - elapsed);
		const isSuccess = status === "authenticated";

		schedule(() => {
			setVerifyPhase(isSuccess ? "success" : "exiting");
		}, wait);

		schedule(() => {
			setVerifyPhase("exiting");
		}, wait + (isSuccess ? SUCCESS_HOLD_MS : 0));

		schedule(() => {
			setShowVerify(false);
			startedAt.current = null;
		}, wait + (isSuccess ? SUCCESS_HOLD_MS : 0) + EXIT_MS);

		return clearTimers;
	}, [status, isLanding, isPreview, isOnboarding]);

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
		return <AuthVerifyingScreen phase={verifyPhase} />;
	}

	if (status === "unauthenticated" && isLogin) {
		return children;
	}

	if (status === "authenticated") {
		return <div className="auth-guard-enter">{children}</div>;
	}

	return null;
}
