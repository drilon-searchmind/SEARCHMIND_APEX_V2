import {
	FiBarChart2,
	FiCalendar,
	FiLink2,
	FiMail,
	FiShare2,
	FiTrendingUp,
} from "react-icons/fi";
import { RiMicrosoftLine } from "react-icons/ri";
import {
	SiGoogleanalytics,
	SiGoogleads,
	SiInstagram,
	SiMagento,
	SiMeta,
	SiPinterest,
	SiReddit,
	SiShopify,
	SiSnapchat,
	SiTiktok,
	SiWoocommerce,
	SiYoutube,
} from "react-icons/si";

/** @type {Record<string, { Icon: import("react-icons").IconType, color?: string }>} */
export const INTEGRATION_ICONS = {
	Meta: { Icon: SiMeta, color: "#0866FF" },
	"Google Ads": { Icon: SiGoogleads, color: "#4285F4" },
	Shopify: { Icon: SiShopify, color: "#95BF47" },
	Klaviyo: { Icon: FiMail, color: "#953995" },
	GA4: { Icon: SiGoogleanalytics, color: "#E37400" },
	Pinterest: { Icon: SiPinterest, color: "#E60023" },
	Snapchat: { Icon: SiSnapchat, color: "#FFFC00" },
	Reddit: { Icon: SiReddit, color: "#FF4500" },
	"Microsoft Ads": { Icon: RiMicrosoftLine, color: "#008373" },
	TikTok: { Icon: SiTiktok, color: "#1A2525" },
	"Magento 2": { Icon: SiMagento, color: "#F26322" },
	Ahrefs: { Icon: FiLink2, color: "#FF8800" },
	Instagram: { Icon: SiInstagram, color: "#E4405F" },
	WooCommerce: { Icon: SiWoocommerce, color: "#96588A" },
	YouTube: { Icon: SiYoutube, color: "#FF0000" },
};

/** @type {Record<string, { Icon: import("react-icons").IconType, color?: string }>} */
export const SERVICE_ICONS = {
	SEO: { Icon: FiTrendingUp, color: "var(--color-accent-light)" },
	PPC: { Icon: SiGoogleads, color: "#4285F4" },
	"Paid Social": { Icon: SiMeta, color: "#0866FF" },
	Pinterest: { Icon: SiPinterest, color: "#E60023" },
	Snapchat: { Icon: SiSnapchat, color: "#FFFC00" },
	Reddit: { Icon: SiReddit, color: "#FF4500" },
	"Bing Ads": { Icon: RiMicrosoftLine, color: "#008373" },
	Klaviyo: { Icon: FiMail, color: "#953995" },
	"Share of Search": { Icon: FiShare2, color: "var(--color-accent-light)" },
	"Campaign Planner": { Icon: FiCalendar, color: "var(--color-neutral)" },
	"Bing Webmaster": { Icon: RiMicrosoftLine, color: "#008373" },
};

/**
 * @param {{ name: string, map: Record<string, { Icon: import("react-icons").IconType, color?: string }>, className?: string, size?: number }} props
 */
export default function PlatformIcon({ name, map, className = "apex-landing__platform-icon", size = 22 }) {
	const entry = map[name];
	const Icon = entry?.Icon ?? FiBarChart2;
	const color = entry?.color ?? "var(--color-accent-light)";

	return (
		<Icon
			className={className}
			size={size}
			style={{ color, flexShrink: 0 }}
			aria-hidden
		/>
	);
}
