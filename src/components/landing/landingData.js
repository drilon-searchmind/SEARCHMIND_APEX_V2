export const HUBSPOT_FORM = {
	region: "eu1",
	portalId: "144135289",
	formId: "6b8920e2-dd5d-4cce-98e1-a60945380c3d",
};

export const METRIC_CARDS = [
	{ label: "TOTAL SALES EXCL. VAT", val: "1.340.236 kr.", delta: "862%" },
	{ label: "GROSS PROFIT", val: "866.014 kr.", delta: "746%" },
	{ label: "BLENDED ROAS", val: "23,41", delta: "12,40" },
	{ label: "NET PROFIT", val: "810.543 kr.", delta: "798%" },
];

export const BAR_HEIGHTS = [62, 48, 80, 40, 70, 55, 95, 30, 26, 22, 16];

export const INTEGRATIONS = [
	"Meta",
	"Google Ads",
	"Shopify",
	"Klaviyo",
	"GA4",
	"Pinterest",
	"Snapchat",
	"Reddit",
	"Microsoft Ads",
	"TikTok",
	"Magento 2",
	"Ahrefs",
	"Instagram",
	"WooCommerce",
	"YouTube",
];

export const STEPS = [
	{
		n: "01",
		t: "Forbind dine platforme",
		d: "Giv Apex adgang i vores opsætningsflow — Meta, Google Ads, Shopify, Klaviyo, GA4 og flere. Ingen udviklere.",
	},
	{
		n: "02",
		t: "Apex samler din data",
		d: "Vi konsoliderer alt på tværs af kanaler og markeder, automatisk hver dag. Du behøver ikke røre et regneark.",
	},
	{
		n: "03",
		t: "Få det fulde overblik",
		d: "Live dashboards, P&L og AI-audits klar fra dag ét — i ét sandt overblik over hele forretningen.",
	},
];

export const REPORTS = [
	{
		id: "overview",
		path: "performance-dashboard",
		name: "Overview",
		desc: "Samlet performance på tværs af salg, marketing og bundlinje.",
		long: "Hele forretningen på én skærm — fra bruttosalg og rabatter til ad spend og nettoresultat. Skift mellem standard- og custom-visning og bor ned i hver enkelt post.",
		metrics: [
			{ label: "Total Sales", val: "1.475.181 kr." },
			{ label: "Gross Profit", val: "965.217 kr." },
			{ label: "Net Profit", val: "892.081 kr." },
			{ label: "Ordrer", val: "2.648" },
		],
	},
	{
		id: "daily",
		path: "daily-overview",
		name: "Daily",
		desc: "Dagligt overblik over dine vigtigste metrics.",
		long: "Dag-for-dag udvikling i ordrer, omsætning, ad spend og resultat — med total, sidste års periode og index, så du straks ser om du er på rette kurs.",
		metrics: [
			{ label: "Ordrer (18d)", val: "2.648" },
			{ label: "Net Revenue", val: "1.749.945 kr." },
			{ label: "Ø ROAS", val: "23,41" },
			{ label: "Net Profit", val: "892.081 kr." },
		],
	},
	{
		id: "pace",
		path: "tools/pace-report",
		name: "Pace Report",
		desc: "Er du foran eller bagud i forhold til dine mål?",
		long: "Pace Report holder dine faktiske tal op mod månedens mål og fremskriver, hvor du lander — så du kan justere budget og indsats før måneden er slut.",
		metrics: [
			{ label: "Spend pace", val: "86%" },
			{ label: "Actual spend", val: "73.135 kr." },
			{ label: "Budget", val: "85.000 kr." },
		],
	},
	{
		id: "pnl",
		path: "tools/pnl",
		name: "P&L",
		desc: "Profit & loss — fra bruttosalg til nettoresultat.",
		long: "En komplet resultatopgørelse der trækker rabatter, returneringer, COGS og ad spend fra bruttosalget — så du ser den reelle bundlinje, ikke kun toplinjen.",
		metrics: [
			{ label: "Bruttosalg", val: "3.888.422 kr." },
			{ label: "Total sales excl. VAT", val: "1.475.181 kr." },
			{ label: "Total DB1", val: "965.217 kr." },
		],
	},
	{
		id: "ecom",
		path: "ecommerce",
		name: "Ecommerce",
		desc: "Product- og customer performance, samlet ét sted.",
		long: "Se dine bedst sælgende produkter, marginer og kundeadfærd — split på nye vs. tilbagevendende kunder — og find ud af hvad der reelt driver væksten.",
		metrics: [
			{ label: "Inventory stock", val: "77.595" },
			{ label: "Inventory value", val: "1.758.549 kr." },
			{ label: "Ø kurv", val: "569 kr." },
		],
	},
];

export const SERVICES = [
	{ name: "SEO", badge: "BETA" },
	{ name: "PPC", badge: "BETA" },
	{ name: "Paid Social", badge: "BETA" },
	{ name: "Pinterest", badge: "BETA" },
	{ name: "Snapchat", badge: "BETA" },
	{ name: "Reddit", badge: "BETA" },
	{ name: "Bing Ads", badge: "BETA" },
	{ name: "Klaviyo", badge: "BETA" },
	{ name: "Share of Search", badge: "NEW" },
	{ name: "Campaign Planner", badge: "WIP" },
	{ name: "Bing Webmaster", badge: "WIP" },
];

export const RADAR_POINTS = [
	"Performance-rapportering på kampagne-, annoncegruppe- og annonceniveau.",
	"Automatisk overvågning der fanger udsving i ROAS, spend og konvertering.",
	"Anomali-alerts direkte til dit team — før små problemer bliver dyre.",
];

export const PLAN_FEATURES = [
	"Alle kernerapporter",
	"Service-dashboards",
	"Apex Radar",
	"Tracking Score",
	"AI-audits",
	"Ubegrænsede markeder",
	"Team & deling",
	"Eksport til PDF",
];

export const FAQS = [
	{
		q: "Hvor lang tid tager opsætningen?",
		a: "Typisk under 10 minutter. Du forbinder dine konti via vores opsætningsflow, og Apex begynder at hente og konsolidere din data automatisk. Ingen udviklere eller integrationsprojekter.",
	},
	{
		q: "Hvordan kommer jeg i gang?",
		a: "Udfyld formularen, så starter opsætningsflowet, når du har givet adgang til de ønskede kanaler, bliver din Apex-konto sat op. Du har fuld adgang i hele prøveperioden.",
	},
	{
		q: "Hvilke platforme kan jeg forbinde?",
		a: "Blandt andet Meta, Google Ads, Shopify, Klaviyo, GA4, Pinterest, Snapchat, Reddit og Microsoft/Bing Ads. Vi tilføjer løbende flere kanaler.",
	},
	{
		q: "Hvad er Apex Radar?",
		a: "Apex Radar er performance-rapportering, dybdegående analyse og løbende overvågning af dine Meta- og Google Ads-konti — med automatiske alerts når noget skiller sig ud.",
	},
	{
		q: "Hvad er Tracking Score?",
		a: "En løbende audit der overvåger dine sporings-opsætninger og samler dem til én score. Hvis din tracking går ned, får du og dit team besked med det samme.",
	},
	{
		q: "Kan jeg dele dashboards med mit team?",
		a: "Ja. Inviter kolleger, arbejd sammen og del rapporter via link eller eksportér til PDF — alt sammen inkluderet i abonnementet.",
	},
];
