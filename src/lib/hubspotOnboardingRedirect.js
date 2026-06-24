import { ONBOARDING_ACCESS_PATH } from "@/lib/onboardingAccessData";
import { buildOnboardingLeadQuery, normalizeOnboardingLead } from "@/lib/onboardingLead";

/** @typedef {import("@/lib/onboardingLead").OnboardingLeadInput} HubSpotLead */

export function buildOnboardingRedirectUrl(lead = {}) {
	const params = buildOnboardingLeadQuery(lead);
	const query = params.toString();
	const origin = typeof window !== "undefined" ? window.location.origin : "";
	return `${origin}${ONBOARDING_ACCESS_PATH}${query ? `?${query}` : ""}`;
}

function pickFormValue(formData, ...keys) {
	for (const key of keys) {
		const direct = formData.get(key);
		if (direct != null && String(direct).trim()) return String(direct).trim();
	}
	for (const [name, value] of formData.entries()) {
		const normalized = String(name).toLowerCase();
		for (const key of keys) {
			if (
				normalized === key.toLowerCase()
				|| normalized.endsWith(`/${key.toLowerCase()}`)
				|| normalized.endsWith(`_${key.toLowerCase()}`)
			) {
				if (value != null && String(value).trim()) return String(value).trim();
			}
		}
	}
	return "";
}

/** @param {HTMLFormElement | null | undefined} form */
export function readLeadFromFormElement(form) {
	if (!form) return {};
	const fd = new FormData(form);
	return normalizeOnboardingLead({
		email: pickFormValue(fd, "email"),
		fornavn: pickFormValue(fd, "firstname", "first_name", "fornavn"),
		efternavn: pickFormValue(fd, "lastname", "last_name", "efternavn"),
		tlf: pickFormValue(fd, "phone", "mobilephone", "tlf"),
		virksomhed: pickFormValue(fd, "company", "virksomhed"),
	});
}

/** @param {import("jquery")} $form */
export function readLeadFromJQueryForm($form) {
	if (!$form?.find) return readLeadFromFormElement($form?.[0]);
	const get = (name) => {
		const val = $form.find(`input[name="${name}"], textarea[name="${name}"]`).val();
		return val != null && String(val).trim() ? String(val).trim() : "";
	};
	const lead = normalizeOnboardingLead({
		email: get("email"),
		fornavn: get("firstname") || get("first_name") || get("fornavn"),
		efternavn: get("lastname") || get("last_name") || get("efternavn"),
		tlf: get("phone") || get("mobilephone") || get("tlf"),
		virksomhed: get("company") || get("virksomhed"),
	});
	if (lead.email || lead.fornavn || lead.virksomhed) return lead;
	return readLeadFromFormElement($form[0]);
}

/** @param {Record<string, unknown>} submissionValues */
export function readLeadFromSubmissionValues(submissionValues) {
	if (!submissionValues || typeof submissionValues !== "object") return {};
	return normalizeOnboardingLead({
		email: submissionValues.email,
		fornavn: submissionValues.firstname ?? submissionValues.first_name ?? submissionValues.fornavn,
		efternavn: submissionValues.lastname ?? submissionValues.last_name ?? submissionValues.efternavn,
		tlf: submissionValues.phone ?? submissionValues.mobilephone ?? submissionValues.tlf,
		virksomhed: submissionValues.company ?? submissionValues.virksomhed,
	});
}

/** @param {{ name?: string, value?: string }[]} fieldValues */
export function readLeadFromV4FieldValues(fieldValues) {
	/** @type {Record<string, string>} */
	const raw = {};
	for (const field of fieldValues ?? []) {
		const rawName = String(field?.name ?? "");
		const key = rawName.split("/").pop()?.toLowerCase() ?? rawName.toLowerCase();
		const value = String(field?.value ?? "").trim();
		if (!value) continue;
		raw[key] = value;
	}
	return normalizeOnboardingLead({
		email: raw.email,
		fornavn: raw.firstname ?? raw.first_name ?? raw.fornavn,
		efternavn: raw.lastname ?? raw.last_name ?? raw.efternavn,
		tlf: raw.phone ?? raw.mobilephone ?? raw.tlf,
		virksomhed: raw.company ?? raw.virksomhed,
	});
}

function isOurHubSpotForm(formId, payload) {
	if (!payload) return false;
	const id = String(payload.id ?? payload.formGuid ?? payload.formId ?? "");
	if (!id) return true;
	return id === formId;
}

/**
 * Wire all known HubSpot submission hooks → onboarding redirect.
 * @param {string} formId
 * @param {{ getLead: () => HubSpotLead, redirect: (lead: HubSpotLead) => void }} handlers
 */
export function attachHubSpotOnboardingRedirect(formId, { getLead, redirect }) {
	/** @type {MutationObserver | null} */
	let successObserver = null;

	const go = (leadOverride) => {
		const lead = normalizeOnboardingLead({
			...getLead(),
			...leadOverride,
		});
		redirect(lead);
	};

	const onMessage = (event) => {
		const data = event?.data;
		if (!data || data.type !== "hsFormCallback") return;
		if (!isOurHubSpotForm(formId, data)) return;

		if (data.eventName === "onFormSubmit" || data.eventName === "onFormSubmitted") {
			const fromSubmission = readLeadFromSubmissionValues(data.data?.submissionValues);
			go(fromSubmission);
		}
	};

	const onV4Success = async (event) => {
		try {
			const v4 = window.HubSpotFormsV4;
			if (v4?.getFormFromEvent) {
				const form = v4.getFormFromEvent(event);
				if (form?.getFormId && form.getFormId() !== formId) return;
				if (form?.getFormFieldValues) {
					const fieldValues = await form.getFormFieldValues();
					go(readLeadFromV4FieldValues(fieldValues));
					return;
				}
			}
		} catch {
			/* fall through */
		}
		go({});
	};

	window.addEventListener("message", onMessage);
	window.addEventListener("hs-form-event:on-submission:success", onV4Success);

	return {
		watchForSubmittedMessage(root) {
			if (!root || successObserver) return;
			successObserver = new MutationObserver(() => {
				if (root.querySelector(".submitted-message")) {
					go({});
				}
			});
			successObserver.observe(root, { childList: true, subtree: true, attributes: true });
		},
		dispose() {
			window.removeEventListener("message", onMessage);
			window.removeEventListener("hs-form-event:on-submission:success", onV4Success);
			successObserver?.disconnect();
			successObserver = null;
		},
	};
}
