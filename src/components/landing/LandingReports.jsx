"use client";

import { REPORTS } from "./landingData";
import { useLanding } from "./LandingContext";

function ChartIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
			<rect x="4" y="12" width="3.4" height="7" rx="1.4" fill="currentColor" />
			<rect x="10.3" y="8" width="3.4" height="11" rx="1.4" fill="currentColor" />
			<rect x="16.6" y="5" width="3.4" height="14" rx="1.4" fill="currentColor" />
		</svg>
	);
}

export default function LandingReports() {
	const { openReport } = useLanding();

	return (
		<section id="rapporter" className="apex-landing__reports">
			<div className="apex-landing__reports-head">
				<div>
					<p className="apex-landing__eyebrow">Inkluderet fra dag ét</p>
					<h2 className="apex-landing__section-title">Rapporter der bare virker</h2>
				</div>
				<div className="apex-landing__reports-aside">
					<p className="apex-landing__muted">
						Fem kernerapporter klar med det samme — bygget til e-commerce og performance marketing.
					</p>
					<div className="apex-landing__reports-hint">
						<span className="apex-landing__reports-hint-dot" aria-hidden />
						Klik på en rapport for et live-eksempel
					</div>
				</div>
			</div>
			<div className="apex-landing__reports-grid">
				{REPORTS.map((report) => (
					<button
						key={report.id}
						type="button"
						className="apex-landing__report-card"
						onClick={() => openReport(report.id)}
					>
						<div className="apex-landing__report-icon">
							<ChartIcon />
						</div>
						<div className="apex-landing__report-name">{report.name}</div>
						<p className="apex-landing__report-desc">{report.desc}</p>
						<span className="apex-landing__report-cta">
							Åbn preview <span aria-hidden>→</span>
						</span>
					</button>
				))}
			</div>
		</section>
	);
}
