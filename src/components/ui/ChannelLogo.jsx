import { FiMail } from "react-icons/fi";
import { RiMicrosoftFill } from "react-icons/ri";
import { SiGoogle, SiGoogleads, SiLinkedin, SiMeta, SiPinterest, SiReddit, SiSnapchat, SiTiktok } from "react-icons/si";

/**
 * Brand logo tiles for ad channels: the brand colour as a rounded square with the mark on top, so the
 * logo stays readable on any background (Snapchat yellow included).
 * @type {Record<string, { Icon: import("react-icons").IconType, bg: string, fg: string, label: string }>}
 */
const CHANNELS = {
    facebook: { Icon: SiMeta, bg: "#0866FF", fg: "#fff", label: "Meta" },
    meta: { Icon: SiMeta, bg: "#0866FF", fg: "#fff", label: "Meta" },
    google: { Icon: SiGoogleads, bg: "#4285F4", fg: "#fff", label: "Google Ads" },
    pinterest: { Icon: SiPinterest, bg: "#E60023", fg: "#fff", label: "Pinterest" },
    snapchat: { Icon: SiSnapchat, bg: "#FFFC00", fg: "#111A12", label: "Snapchat" },
    bing: { Icon: RiMicrosoftFill, bg: "#008373", fg: "#fff", label: "Microsoft Ads" },
    reddit: { Icon: SiReddit, bg: "#FF4500", fg: "#fff", label: "Reddit" },
    linkedin: { Icon: SiLinkedin, bg: "#0A66C2", fg: "#fff", label: "LinkedIn" },
    tiktok: { Icon: SiTiktok, bg: "#111A12", fg: "#fff", label: "TikTok" },
    // SEO uses the Google "G" on a white tile so it reads differently from the Google Ads tile
    seo: { Icon: SiGoogle, bg: "#fff", fg: "#4285F4", label: "Google Search", border: "1px solid #D2DBD0" },
    // Klaviyo: placeholder mark (mail glyph on Klaviyo's near-black). The official logo is not in the
    // repo yet; once it is, point `src` at it and it replaces the glyph.
    klaviyo: { Icon: FiMail, bg: "#232426", fg: "#fff", label: "Klaviyo" },
    email: { Icon: FiMail, bg: "#232426", fg: "#fff", label: "Klaviyo" },
};

/**
 * @param {{ channel: string, size?: number, title?: string }} props
 */
export default function ChannelLogo({ channel, size = 20, title }) {
    const entry = CHANNELS[String(channel || "").toLowerCase()];
    if (!entry) return null;
    const { Icon, bg, fg, label, border } = entry;
    const glyph = Math.round(size * 0.58);
    return (
        <span
            aria-hidden
            title={title ?? label}
            style={{
                display: "inline-grid",
                placeItems: "center",
                width: size,
                height: size,
                borderRadius: Math.max(4, Math.round(size * 0.28)),
                background: bg,
                color: fg,
                border,
                boxSizing: "border-box",
                flexShrink: 0,
            }}
        >
            {/* Inline size and colour so surrounding menu styles (which restyle every svg) cannot change the logo */}
            <Icon style={{ width: glyph, height: glyph, color: fg }} />
        </span>
    );
}
