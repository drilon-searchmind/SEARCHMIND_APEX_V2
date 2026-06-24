import HubSpotForm from "./HubSpotForm";
import { PLAN_FEATURES } from "./landingData";

export default function LandingPricing() {
	return (
		<section id="kontakt" className="apex-landing__pricing">
			<div className="apex-landing__pricing-panel">
				<div className="apex-landing__pricing-grid">
					<div>
						<p className="apex-landing__eyebrow">Kom i gang</p>
						<h2 className="apex-landing__pricing-title">
							Start din 30 dages
							<br />
							gratis prøve
						</h2>
						<p className="apex-landing__pricing-lede">
							Udfyld formularen og giv adgang til jeres kanaler — så sætter vi Apex op med fuld adgang fra dag ét.
						</p>
						<div className="apex-landing__pricing-features">
							{PLAN_FEATURES.map((feature) => (
								<div key={feature} className="apex-landing__pricing-feature">
									<span className="apex-landing__pricing-check" aria-hidden>✓</span>
									{feature}
								</div>
							))}
						</div>
					</div>
					<div className="apex-landing__pricing-form">
						<p className="apex-landing__form-eyebrow">Tilmeld dig</p>
						<h3 className="apex-landing__form-title">Udfyld formularen</h3>
						<p className="apex-landing__form-lede">Trin 1 — derefter guider vi jer gennem adgang til Shopify, Meta, Google Ads m.fl.</p>
						<HubSpotForm />
					</div>
				</div>
			</div>
		</section>
	);
}
