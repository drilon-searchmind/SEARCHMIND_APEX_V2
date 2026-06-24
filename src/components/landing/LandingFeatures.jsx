"use client";

import { useLanding } from "./LandingContext";

export default function LandingFeatures() {
	const { scrollToSignup } = useLanding();

	return (
		<section className="apex-landing__features">
			<div className="apex-landing__features-grid">
				<article className="apex-landing__feature-card apex-landing__feature-card--light">
					<p className="apex-landing__eyebrow">Tracking Score</p>
					<h3 className="apex-landing__feature-title">Få besked hvis din tracking går ned</h3>
					<p className="apex-landing__feature-copy">
						Apex pinger løbende dine sporings-opsætninger og giver dig én score for, hvor pålidelig din data er. Falder den, ved du det med det samme.
					</p>
					<div className="apex-landing__score-row">
						<div className="apex-landing__score-box apex-landing__score-box--ok">
							<div className="apex-landing__score-head">
								<div className="apex-landing__score-value">94</div>
								<div className="apex-landing__score-label">Sund tracking</div>
							</div>
							<div className="apex-landing__score-bar">
								<div className="apex-landing__score-bar-fill" style={{ width: "94%" }} />
							</div>
						</div>
						<div className="apex-landing__score-box apex-landing__score-box--warn">
							<div className="apex-landing__score-alert">
								<span aria-hidden>⚠</span> Server-side tag svarer ikke
							</div>
							<div className="apex-landing__score-alert-detail">
								Opdaget kl. 04:12 · Apex har sendt en alert til dit team.
							</div>
						</div>
					</div>
				</article>

				<article className="apex-landing__feature-card apex-landing__feature-card--dark">
					<div className="apex-landing__feature-glow" aria-hidden />
					<p className="apex-landing__eyebrow">AI Audit</p>
					<h3 className="apex-landing__feature-title">Indsigter genereret på dine egne tal</h3>
					<p className="apex-landing__feature-copy">
						Indsæt din favorit LLM API KEY og kør en AI-audit og få konkrete anbefalinger baseret på dine Apex-tal — ikke generiske råd. Find lækager, spild og muligheder på sekunder.
					</p>
					<div className="apex-landing__ai-box">
						<div className="apex-landing__ai-status">
							<span className="apex-landing__ai-status-dot" aria-hidden />
							Apex analyserer 11 dages data…
						</div>
						<p className="apex-landing__ai-quote">
							«Din POAS på Google Ads er faldet 18% på 4 dage. Skift budget mod kampagner med ROAS &gt; 25 for at beskytte din bundlinje.»
						</p>
					</div>
					<button type="button" className="apex-landing__btn apex-landing__btn--primary apex-landing__feature-cta" onClick={scrollToSignup}>
						Kør din første audit →
					</button>
				</article>
			</div>
		</section>
	);
}
