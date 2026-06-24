"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function PreviewShellInner({ children }) {
	const searchParams = useSearchParams();
	const embed = searchParams.get("embed") === "1";

	return (
		<div className={`apex-preview${embed ? " apex-preview--embed" : ""}`} data-theme="cobalt">
			<main className="apex-preview__main">{children}</main>
		</div>
	);
}

export default function PreviewShell({ children }) {
	return (
		<Suspense fallback={<div className="apex-preview" data-theme="cobalt" />}>
			<PreviewShellInner>{children}</PreviewShellInner>
		</Suspense>
	);
}
