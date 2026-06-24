import { SERVICES } from "./landingData";
import PlatformIcon, { SERVICE_ICONS } from "./platformIcons";

function badgeClass(badge) {
	if (badge === "NEW") return "apex-landing__badge apex-landing__badge--new";
	if (badge === "WIP") return "apex-landing__badge apex-landing__badge--wip";
	return "apex-landing__badge apex-landing__badge--beta";
}

export default function LandingServiceDashboards() {
	return (
		<section className="apex-landing__services">
			<div className="apex-landing__services-panel">
				<div className="apex-landing__services-head">
					<h2 className="apex-landing__section-title">
						Service-dashboards for hver kanal
					</h2>
					<p className="apex-landing__muted">
						Dyk ned i den enkelte kanal — eller se det hele samlet. Flere kanaler kommer hele tiden til.
					</p>
				</div>
				<div className="apex-landing__services-grid">
					{SERVICES.map((service) => (
						<div key={service.name} className="apex-landing__service-card">
							<span className="apex-landing__service-name">
								<PlatformIcon name={service.name} map={SERVICE_ICONS} />
								{service.name}
							</span>
							<span className={badgeClass(service.badge)}>{service.badge}</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
