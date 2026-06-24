"use client";

import Image from "next/image";
import { BAR_HEIGHTS, METRIC_CARDS } from "./landingData";
import { useLanding } from "./LandingContext";

export default function LandingHero() {
	const { scrollToSignup } = useLanding();

	return (
		<section className="apex-landing__hero">
			<div className="apex-landing__hero-grid">
				<div>
					<div className="apex-landing__pill">
						<span className="apex-landing__pill-dot" aria-hidden />
						Ét dashboard. Al din data.
					</div>
					<h1 className="apex-landing__hero-title">
						Saml al din
						<br />
						marketingdata —
						<br />
						og udnyt den målrettet
					</h1>
					<p className="apex-landing__hero-lead">
						Apex konsoliderer data på tværs af alle dine kanaler i ét levende dashboard — fra daglige tal og P&amp;L til SEO, PPC og e-commerce. Sat op på minutter, ikke uger.
					</p>
					<div className="apex-landing__hero-cta">
						<button type="button" className="apex-landing__btn apex-landing__btn--primary" onClick={scrollToSignup}>
							Start 30 dages gratis prøve <span aria-hidden>→</span>
						</button>
						<a href="#rapporter" className="apex-landing__btn apex-landing__btn--secondary">
							Se hvordan det virker
						</a>
					</div>
					<div className="apex-landing__hero-trust">
						<span><span className="apex-landing__check">✓</span> Ingen binding</span>
						<span><span className="apex-landing__check">✓</span> Hurtig opsætning</span>
						<span><span className="apex-landing__check">✓</span> Live data</span>
					</div>
				</div>

				<div className="apex-landing__mock-wrap">
					<div className="apex-landing__mock-glow" aria-hidden />
					<div className="apex-landing__mock">
						<div className="apex-landing__mock-sidebar">
							<Image
								src="/images/icons/apex-icon-svg.svg"
								alt=""
								width={15}
								height={15}
							/>
							<div className="apex-landing__mock-sidebar-active" aria-hidden />
							{Array.from({ length: 5 }).map((_, i) => (
								<div key={i} className="apex-landing__mock-sidebar-dot" aria-hidden />
							))}
						</div>
						<div className="apex-landing__mock-main">
							<div className="apex-landing__mock-top">
								<div>
									<div className="apex-landing__mock-tag">Nordic Sports DK</div>
									<div className="apex-landing__mock-title">Performance Dashboard</div>
								</div>
								<div className="apex-landing__mock-actions">
									<div className="apex-landing__mock-chip apex-landing__mock-chip--dark">Export</div>
									<div className="apex-landing__mock-chip apex-landing__mock-chip--outline">Run audit</div>
								</div>
							</div>
							<div className="apex-landing__mock-metrics">
								{METRIC_CARDS.map((m) => (
									<div key={m.label} className="apex-landing__mock-metric">
										<div className="apex-landing__mock-metric-label">{m.label}</div>
										<div className="apex-landing__mock-metric-row">
											<div className="apex-landing__mock-metric-val">{m.val}</div>
											<div className="apex-landing__mock-delta">↗ {m.delta}</div>
										</div>
									</div>
								))}
							</div>
							<div className="apex-landing__mock-chart">
								<div className="apex-landing__mock-chart-head">
									<span>Net Revenue</span>
									<span>seneste 11 dage</span>
								</div>
								<div className="apex-landing__mock-bars">
									{BAR_HEIGHTS.map((h, i) => (
										<div
											key={i}
											className={`apex-landing__mock-bar${i === 6 ? " apex-landing__mock-bar--peak" : ""}`}
											style={{ height: `${h}%` }}
										/>
									))}
								</div>
							</div>
						</div>
					</div>
					<div className="apex-landing__tracking-chip">
						<div className="apex-landing__tracking-ring">
							<div className="apex-landing__tracking-ring-bg" aria-hidden />
							<div className="apex-landing__tracking-ring-inner">92</div>
						</div>
						<div className="apex-landing__tracking-copy">
							<strong>Tracking Score</strong>
							<span>Alt kører</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
