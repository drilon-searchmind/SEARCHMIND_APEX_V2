"use client";

import "./landing.css";

import LandingFaq from "./LandingFaq";
import LandingFeatures from "./LandingFeatures";
import LandingHeader from "./LandingHeader";
import LandingHero from "./LandingHero";
import LandingHowItWorks from "./LandingHowItWorks";
import LandingIntegrations from "./LandingIntegrations";
import LandingPricing from "./LandingPricing";
import LandingRadar from "./LandingRadar";
import LandingReports from "./LandingReports";
import LandingServiceDashboards from "./LandingServiceDashboards";
import { LandingProvider } from "./LandingContext";
import ReportPreviewModal from "./ReportPreviewModal";

export default function LandingPage() {
	return (
		<LandingProvider>
			<main className="apex-landing" data-screen-label="Apex Landing">
				<LandingHeader />
				<LandingHero />
				<LandingIntegrations />
				<LandingHowItWorks />
				<LandingReports />
				<LandingServiceDashboards />
				<LandingRadar />
				<LandingFeatures />
				<LandingPricing />
				<LandingFaq />
				<ReportPreviewModal />
			</main>
		</LandingProvider>
	);
}
