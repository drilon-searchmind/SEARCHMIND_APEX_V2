/**
 * Onboarding access flow — channel definitions & share targets.
 * Override share emails/IDs via NEXT_PUBLIC_ONBOARDING_* env vars when wired to backend.
 */

const googleServiceAccount =
	typeof process !== "undefined" && process.env.NEXT_PUBLIC_ONBOARDING_GOOGLE_SERVICE_ACCOUNT
		? process.env.NEXT_PUBLIC_ONBOARDING_GOOGLE_SERVICE_ACCOUNT
		: "searchmind-apex-google-ads@perfect-victor-481319-r1.iam.gserviceaccount.com";

export const ONBOARDING_CONTACT_EMAIL =
	typeof process !== "undefined" && process.env.NEXT_PUBLIC_ONBOARDING_CONTACT_EMAIL
		? process.env.NEXT_PUBLIC_ONBOARDING_CONTACT_EMAIL
		: "mc@searchmind.dk";

const metaPartnerId =
	typeof process !== "undefined" && process.env.NEXT_PUBLIC_ONBOARDING_META_PARTNER_ID
		? process.env.NEXT_PUBLIC_ONBOARDING_META_PARTNER_ID
		: "607663036232275";

const googleAdsMccId =
	typeof process !== "undefined" && process.env.NEXT_PUBLIC_ONBOARDING_GOOGLE_ADS_MCC_ID
		? process.env.NEXT_PUBLIC_ONBOARDING_GOOGLE_ADS_MCC_ID
		: "663-503-8416";

/** @typedef {"idle" | "claimed" | "verifying" | "verified" | "failed"} ChannelAccessStatus */

/**
 * @typedef {object} OnboardingChannel
 * @property {string} id
 * @property {string} name
 * @property {"store" | "ads" | "analytics" | "email"} category
 * @property {string} categoryLabel
 * @property {string} summary
 * @property {string[]} steps
 * @property {{ label: string, value: string }[]} [shareTargets]
 * @property {{ id: string, label: string, placeholder?: string }[]} [fields]
 * @property {boolean} [recommended]
 */

/** @type {OnboardingChannel[]} */
export const ONBOARDING_CHANNELS = [
	{
		id: "shopify",
		name: "Shopify",
		category: "store",
		categoryLabel: "Webshop",
		recommended: true,
		summary: "Vi installerer Searchminds custom app og genererer access token — det kræver fuld adgang til jeres shop.",
		steps: [
			"Inviter Searchmind som collaborator/staff på shoppen med fuld adgang til Apps og indstillinger.",
			"Alternativt: giv adgang til jeres Shopify Partners-kontakt hos Searchmind, så vi kan installere appen for jer.",
			"Når appen er installeret, genererer vi Admin API access token via vores custom app.",
			"Send os jeres myshopify.com-URL (fx brand.myshopify.com).",
		],
		shareTargets: [
			{ label: "Inviter denne e-mail som staff/collaborator", value: ONBOARDING_CONTACT_EMAIL },
		],
		fields: [
			{ id: "shopUrl", label: "Shopify URL", placeholder: "brand.myshopify.com" },
		],
	},
	{
		id: "meta",
		name: "Meta (Facebook & Instagram Ads)",
		category: "ads",
		categoryLabel: "Paid media",
		recommended: true,
		summary: "Del adgang til jeres annoncekonti via Searchminds Meta Business Manager (MCC) — ikke OAuth.",
		steps: [
			"Gå til Meta Business Settings → Accounts → Ad accounts.",
			"Vælg den relevante ad account og klik Assign partners.",
			"Indtast Searchminds Partner ID nedenfor og tildel mindst Advertiser- eller Analyst-adgang.",
			"Send os jeres Ad Account ID (tal efter act= i Ads Manager URL).",
		],
		shareTargets: [
			{ label: "Searchmind Partner ID", value: metaPartnerId },
		],
		fields: [
			{ id: "adAccountId", label: "Meta Ad Account ID", placeholder: "123456789012345" },
		],
	},
	{
		id: "google-ads",
		name: "Google Ads",
		category: "ads",
		categoryLabel: "Paid media",
		recommended: true,
		summary: "Link jeres Google Ads-konto til Searchminds MCC — vi har ikke self-service OAuth endnu.",
		steps: [
			"Log ind på Google Ads med den konto, der skal deles.",
			"Gå til Tools → Access and security → Managers (MCC).",
			"Klik Link existing account og indtast Searchminds MCC Customer ID.",
			"Accepter link-anmodningen fra Searchmind MCC (eller send os invitationen).",
			"Send os jeres 10-cifrede Google Ads Customer ID.",
		],
		shareTargets: [
			{ label: "Searchmind MCC Customer ID", value: googleAdsMccId },
		],
		fields: [
			{ id: "customerId", label: "Jeres Google Ads Customer ID", placeholder: "1234567890" },
		],
	},
	{
		id: "klaviyo",
		name: "Klaviyo",
		category: "email",
		categoryLabel: "E-mail",
		recommended: true,
		summary: "Opret en Private API Key med read-adgang — eller inviter Searchmind-bruger med passende rettigheder.",
		steps: [
			"Log ind på Klaviyo → Settings → API keys.",
			"Opret en ny Private API Key med Read access til metrics og campaigns.",
			"Send nøglen sikkert til Searchmind (vi gemmer den krypteret i Apex config).",
			"Alternativt: inviter mc@searchmind.dk som bruger med Analyst-adgang.",
		],
		shareTargets: [
			{ label: "Support / setup", value: ONBOARDING_CONTACT_EMAIL },
		],
		fields: [
			{ id: "accountName", label: "Klaviyo account / brand", placeholder: "Brand navn" },
		],
	},
	{
		id: "ga4",
		name: "GA4",
		category: "analytics",
		categoryLabel: "Analytics",
		recommended: true,
		summary: "Tilføj Searchminds Google service account som Viewer på jeres GA4 property.",
		steps: [
			"Åbn Google Analytics → Admin → Property access management.",
			"Klik + → Add users og indsæt service account-e-mailen nedenfor.",
			"Tildel rollen Viewer (read-only er nok til dashboards).",
			"Send os det numeriske Property ID (Admin → Property settings) — ikke G-XXXX measurement ID.",
		],
		shareTargets: [
			{ label: "Google service account (Viewer)", value: googleServiceAccount },
		],
		fields: [
			{ id: "propertyId", label: "GA4 Property ID", placeholder: "123456789" },
		],
	},
	{
		id: "search-console",
		name: "Google Search Console",
		category: "analytics",
		categoryLabel: "Analytics",
		summary: "Giv Searchminds service account Owner- eller Full-adgang til den relevante property.",
		steps: [
			"Åbn Google Search Console og vælg property.",
			"Settings → Users and permissions → Add user.",
			"Indsæt service account-e-mailen og vælg Full eller Owner.",
			"Bekræft at property-URL matcher jeres domæne.",
		],
		shareTargets: [
			{ label: "Google service account", value: googleServiceAccount },
		],
		fields: [
			{ id: "propertyUrl", label: "Search Console property", placeholder: "https://www.example.com/" },
		],
	},
	{
		id: "pinterest",
		name: "Pinterest Ads",
		category: "ads",
		categoryLabel: "Paid media",
		summary: "Del ad account via Pinterest Business — partner invitation til Searchmind.",
		steps: [
			"Log ind på Pinterest Business → Ad accounts.",
			"Inviter Searchmind som partner eller del ad account ID med os.",
			"Send Ad Account ID når invitation er sendt.",
		],
		shareTargets: [
			{ label: "Partner kontakt", value: ONBOARDING_CONTACT_EMAIL },
		],
		fields: [
			{ id: "adAccountId", label: "Pinterest Ad Account ID", placeholder: "1234567890123" },
		],
	},
	{
		id: "bing-ads",
		name: "Microsoft Ads",
		category: "ads",
		categoryLabel: "Paid media",
		summary: "Link jeres Microsoft Advertising-konto til Searchminds manager account.",
		steps: [
			"Log ind på Microsoft Advertising.",
			"Gå til Accounts → Request management access (eller send link invitation til Searchmind).",
			"Send Customer ID og Account ID når adgang er givet.",
		],
		shareTargets: [
			{ label: "Setup kontakt", value: ONBOARDING_CONTACT_EMAIL },
		],
		fields: [
			{ id: "customerId", label: "Microsoft Ads Customer ID", placeholder: "12345678" },
		],
	},
];

export const ONBOARDING_ACCESS_PATH = "/onboarding/access";

export const ONBOARDING_STEPS = [
	{ id: "form", label: "HubSpot formular" },
	{ id: "access", label: "Giv adgang" },
	{ id: "create", label: "Opret konto" },
];

export const ONBOARDING_STORAGE_KEY = "apex-onboarding-access-v1";

/** @returns {Record<string, { status: ChannelAccessStatus, fields: Record<string, string>, verifiedAt?: string }>} */
export function loadOnboardingState() {
	if (typeof window === "undefined") return {};
	try {
		const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

/** @param {Record<string, unknown>} state */
export function saveOnboardingState(state) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
	} catch {
		/* ignore quota */
	}
}
