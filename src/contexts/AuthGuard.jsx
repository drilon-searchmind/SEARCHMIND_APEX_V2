"use client";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AuthGuard({ children }) {
	const { status } = useSession();
	const router = useRouter();
	const pathname = usePathname();


		useEffect(() => {
			// If unauthenticated and not already on /login, redirect to /login
			if (status === "unauthenticated" && pathname !== "/login") {
				router.push("/login");
			}
			// If authenticated and on / or /login, redirect to /home
			if (status === "authenticated" && (pathname === "/" || pathname === "/login")) {
				router.push("/home");
			}
		}, [status, router, pathname]);

	// Show loading spinner only while loading
	if (status === "loading") {
		return (
			<div className="flex items-center justify-center h-screen bg-white">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
					<p className="text-gray-600">Verifying authentication...</p>
				</div>
			</div>
		);
	}

	// If unauthenticated and on /login, allow children (login page)
	if (status === "unauthenticated" && pathname === "/login") {
		return children;
	}

	// If authenticated, allow children
	if (status === "authenticated") {
		return children;
	}

	// Fallback (should not be reached)
	return null;
}
