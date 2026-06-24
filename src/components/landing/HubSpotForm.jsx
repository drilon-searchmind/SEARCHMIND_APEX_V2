"use client";

import { useEffect, useRef } from "react";
import {
	attachHubSpotOnboardingRedirect,
	buildOnboardingRedirectUrl,
	readLeadFromFormElement,
	readLeadFromJQueryForm,
} from "@/lib/hubspotOnboardingRedirect";
import { HUBSPOT_FORM } from "./landingData";

export default function HubSpotForm() {
	const created = useRef(false);
	const leadRef = useRef({});
	const redirectingRef = useRef(false);
	const redirectApiRef = useRef(null);

	useEffect(() => {
		redirectApiRef.current = attachHubSpotOnboardingRedirect(HUBSPOT_FORM.formId, {
			getLead: () => leadRef.current,
			redirect: (lead) => {
				if (redirectingRef.current) return;
				redirectingRef.current = true;
				leadRef.current = lead;
				window.location.assign(buildOnboardingRedirectUrl(lead));
			},
		});

		return () => redirectApiRef.current?.dispose();
	}, []);

	useEffect(() => {
		if (created.current) return undefined;

		const mount = () => {
			if (!window.hbspt || created.current) return;
			const el = document.getElementById("hs-inline-form");
			if (!el || el.firstChild) return;

			window.hbspt.forms.create({
				region: HUBSPOT_FORM.region,
				portalId: HUBSPOT_FORM.portalId,
				formId: HUBSPOT_FORM.formId,
				target: "#hs-inline-form",
				css: "",
				cssRequired: "",
				onFormReady: ($form) => {
					const formEl = $form?.[0] ?? el.querySelector("form");
					formEl?.classList.add("apex-landing__hs-form");

					const captureLead = () => {
						const fromJq = $form ? readLeadFromJQueryForm($form) : {};
						const fromDom = readLeadFromFormElement(formEl);
						leadRef.current = { ...fromDom, ...fromJq };
					};

					formEl?.addEventListener("input", captureLead, true);
					formEl?.addEventListener("submit", captureLead, true);
					redirectApiRef.current?.watchForSubmittedMessage(el);
				},
				onFormSubmit: ($form) => {
					leadRef.current = readLeadFromJQueryForm($form);
				},
				onFormSubmitted: ($form) => {
					leadRef.current = readLeadFromJQueryForm($form);
					if (!redirectingRef.current) {
						redirectingRef.current = true;
						window.location.assign(buildOnboardingRedirectUrl(leadRef.current));
					}
				},
			});
			created.current = true;
		};

		if (window.hbspt) {
			mount();
			return undefined;
		}

		const existing = document.querySelector('script[src*="hsforms.net"]');
		if (!existing) {
			const script = document.createElement("script");
			script.src = "https://js-eu1.hsforms.net/forms/embed/v2.js";
			script.defer = true;
			script.onload = mount;
			document.body.appendChild(script);
		} else {
			const timer = window.setInterval(() => {
				if (window.hbspt) {
					window.clearInterval(timer);
					mount();
				}
			}, 150);
			return () => window.clearInterval(timer);
		}

		return undefined;
	}, []);

	return <div id="hs-inline-form" className="apex-landing__hubspot" />;
}
