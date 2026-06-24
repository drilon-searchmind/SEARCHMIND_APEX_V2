import { RADAR_POINTS } from "./landingData";

export default function LandingRadar() {
	return (
		<section id="radar" className="apex-landing__radar">
			<div className="apex-landing__radar-inner">
				<div>
					<div className="apex-landing__radar-pill">APEX RADAR</div>
					<h2 className="apex-landing__radar-title">
						Hold øje med Meta &amp; Google Ads — automatisk.
					</h2>
					<p className="apex-landing__radar-lead">
						Performance-rapportering, dybdegående analyse og løbende overvågning af dine vigtigste annoncekanaler. Apex Radar fanger udsving før de bliver dyre.
					</p>
					<ul className="apex-landing__radar-list">
						{RADAR_POINTS.map((point) => (
							<li key={point} className="apex-landing__radar-item">
								<span className="apex-landing__radar-check" aria-hidden>✓</span>
								{point}
							</li>
						))}
					</ul>
				</div>
				<div className="apex-landing__radar-visual" aria-hidden>
					<div className="apex-landing__radar-ring apex-landing__radar-ring--1" />
					<div className="apex-landing__radar-ring apex-landing__radar-ring--2" />
					<div className="apex-landing__radar-ring apex-landing__radar-ring--3" />
					<div className="apex-landing__radar-sweep">
						<div className="apex-landing__radar-sweep-inner" />
					</div>
					<div className="apex-landing__radar-dot apex-landing__radar-dot--1" />
					<div className="apex-landing__radar-dot apex-landing__radar-dot--2" />
					<div className="apex-landing__radar-dot apex-landing__radar-dot--3" />
					<div className="apex-landing__radar-core">
						<div className="apex-landing__radar-core-dot" />
					</div>
				</div>
			</div>
		</section>
	);
}
