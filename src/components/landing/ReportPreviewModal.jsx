"use client";

import { useEffect, useState } from "react";
import { REPORTS } from "./landingData";
import { useLanding } from "./LandingContext";
import { getLandingReportPreviewSrc } from "@/lib/landingReportPreview";

export default function ReportPreviewModal() {
	const { activeReportId, closeReport } = useLanding();
	const report = REPORTS.find((r) => r.id === activeReportId);
	const [iframeLoading, setIframeLoading] = useState(true);

	useEffect(() => {
		if (!activeReportId) return undefined;
		setIframeLoading(true);
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [activeReportId]);

	if (!report) return null;

	const previewSrc = getLandingReportPreviewSrc(report);

	return (
		<div
			className="apex-landing__report-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="report-modal-title"
		>
			<button
				type="button"
				className="apex-landing__overlay-backdrop"
				onClick={closeReport}
				aria-label="Luk rapport preview"
			/>
			<div className="apex-landing__report-modal">
				<header className="apex-landing__report-modal-head">
					<div>
						<p className="apex-landing__eyebrow">Live demo preview</p>
						<h2 id="report-modal-title" className="apex-landing__report-modal-title">
							{report.name}
						</h2>
						<p className="apex-landing__report-modal-lede">{report.desc}</p>
					</div>
					<button
						type="button"
						className="apex-landing__report-modal-close"
						onClick={closeReport}
						aria-label="Luk"
					>
						×
					</button>
				</header>
				<div className="apex-landing__report-modal-body">
					{iframeLoading ? (
						<div className="apex-landing__report-modal-loading" aria-live="polite">
							Indlæser dashboard…
						</div>
					) : null}
					<iframe
						key={report.id}
						title={`${report.name} demo preview`}
						className="apex-landing__report-iframe"
						src={previewSrc}
						onLoad={() => setIframeLoading(false)}
					/>
				</div>
			</div>
		</div>
	);
}
