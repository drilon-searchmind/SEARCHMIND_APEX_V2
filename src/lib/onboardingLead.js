/** @typedef {{ email?: string, fornavn?: string, efternavn?: string, tlf?: string, virksomhed?: string, navn?: string }} OnboardingLeadInput */

/** @param {OnboardingLeadInput | Record<string, unknown> | null | undefined} raw */
export function normalizeOnboardingLead(raw = {}) {
	const fornavn = String(raw.fornavn ?? raw.navn ?? raw.firstname ?? "").trim();
	const efternavn = String(raw.efternavn ?? raw.lastname ?? "").trim();
	const email = String(raw.email ?? "").trim().toLowerCase();
	const tlf = String(raw.tlf ?? raw.phone ?? raw.mobilephone ?? "").trim();
	const virksomhed = String(raw.virksomhed ?? raw.company ?? "").trim();

	return {
		email,
		fornavn,
		efternavn,
		tlf,
		virksomhed,
	};
}

/** @param {URLSearchParams | Record<string, string | null | undefined>} source */
export function parseOnboardingLeadFromQuery(source) {
	if (source instanceof URLSearchParams) {
		return normalizeOnboardingLead({
			email: source.get("email"),
			fornavn: source.get("fornavn") ?? source.get("navn"),
			efternavn: source.get("efternavn"),
			tlf: source.get("tlf") ?? source.get("phone"),
			virksomhed: source.get("virksomhed") ?? source.get("company"),
		});
	}
	return normalizeOnboardingLead(source);
}

/** @param {OnboardingLeadInput} lead */
export function buildOnboardingLeadQuery(lead) {
	const normalized = normalizeOnboardingLead(lead);
	const params = new URLSearchParams();
	if (normalized.email) params.set("email", normalized.email);
	if (normalized.fornavn) params.set("fornavn", normalized.fornavn);
	if (normalized.efternavn) params.set("efternavn", normalized.efternavn);
	if (normalized.tlf) params.set("tlf", normalized.tlf);
	if (normalized.virksomhed) params.set("virksomhed", normalized.virksomhed);
	return params;
}

export function formatOnboardingLeadName(lead) {
	const parts = [lead.fornavn, lead.efternavn].filter(Boolean);
	return parts.join(" ").trim();
}
