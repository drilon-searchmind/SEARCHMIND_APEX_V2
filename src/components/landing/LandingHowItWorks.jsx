import { STEPS } from "./landingData";

export default function LandingHowItWorks() {
	return (
		<section id="funktioner" className="apex-landing__steps">
			<div className="apex-landing__steps-intro">
				<p className="apex-landing__eyebrow">Kom hurtigt i gang</p>
				<h2 className="apex-landing__section-title">Forbind. Konsolidér. Forstå.</h2>
				<p className="apex-landing__lede">
					Ingen integrationsprojekter, ingen udviklere, ingen regneark. Du forbinder dine konti, og Apex tager sig af resten.
				</p>
			</div>
			<div className="apex-landing__steps-grid">
				{STEPS.map((step) => (
					<article key={step.n} className="apex-landing__step-card">
						<div className="apex-landing__step-head">
							<div className="apex-landing__step-num">{step.n}</div>
							<div className="apex-landing__step-line" aria-hidden />
						</div>
						<h3 className="apex-landing__step-title">{step.t}</h3>
						<p className="apex-landing__step-copy">{step.d}</p>
					</article>
				))}
			</div>
		</section>
	);
}
