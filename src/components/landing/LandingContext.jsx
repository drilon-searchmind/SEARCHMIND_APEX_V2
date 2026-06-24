"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const SIGNUP_SECTION_ID = "kontakt";

const LandingContext = createContext(null);

export function LandingProvider({ children }) {
	const [openFaq, setOpenFaq] = useState(-1);
	const [activeReportId, setActiveReportId] = useState(null);

	const scrollToSignup = useCallback(() => {
		const section = document.getElementById(SIGNUP_SECTION_ID);
		if (!section) return;
		section.scrollIntoView({ behavior: "smooth", block: "start" });
		window.setTimeout(() => {
			const firstInput = section.querySelector("input:not([type='hidden']), textarea, select");
			firstInput?.focus({ preventScroll: true });
		}, 450);
	}, []);

	const openReport = useCallback((id) => setActiveReportId(id), []);
	const closeReport = useCallback(() => setActiveReportId(null), []);
	const toggleFaq = useCallback(
		(index) => setOpenFaq((prev) => (prev === index ? -1 : index)),
		[]
	);

	useEffect(() => {
		const onKeyDown = (e) => {
			if (e.key === "Escape") setActiveReportId(null);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	const value = useMemo(
		() => ({
			openFaq,
			toggleFaq,
			scrollToSignup,
			activeReportId,
			openReport,
			closeReport,
		}),
		[openFaq, toggleFaq, scrollToSignup, activeReportId, openReport, closeReport]
	);

	return <LandingContext.Provider value={value}>{children}</LandingContext.Provider>;
}

export function useLanding() {
	const ctx = useContext(LandingContext);
	if (!ctx) throw new Error("useLanding must be used within LandingProvider");
	return ctx;
}
