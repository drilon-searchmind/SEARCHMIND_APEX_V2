import { INTEGRATIONS } from "./landingData";
import PlatformIcon, { INTEGRATION_ICONS } from "./platformIcons";

export default function LandingIntegrations() {
	return (
		<section className="apex-landing__integrations" aria-label="Integrationer">
			<div className="apex-landing__integrations-inner">
				<h2 className="apex-landing__integrations-title">
					Henter data direkte fra de platforme du allerede bruger
				</h2>
				<div className="apex-landing__integrations-list">
					{INTEGRATIONS.map((name) => (
						<span key={name} className="apex-landing__integration">
							<PlatformIcon name={name} map={INTEGRATION_ICONS} />
							{name}
						</span>
					))}
				</div>
			</div>
		</section>
	);
}
