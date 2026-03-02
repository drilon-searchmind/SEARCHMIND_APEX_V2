"use client"

import React from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import { FaFacebookSquare, FaWordpress } from "react-icons/fa";
import { SiShopify, SiGoogle, SiGoogleanalytics, SiWoocommerce } from "react-icons/si";
import { FiSearch } from "react-icons/fi";


const sections = [
    {
        id: "meta",
        title: "Meta ",
        items: [
            "Option A: Ads Manager Dropdown (Fastest): Go to Meta Ads Manager, click the dropdown in the top-left corner (usually shows 'Campaigns'), and your account name and ID will appear.",
            "Option B: URL Bar: Open Ads Manager, and the number following act= in the website address bar is your ID.",
            "Option C: Business Settings: Go to Business Settings > Accounts > Ad Accounts to find it listed under the account name.",
        ],
        content: `To find your Meta (Facebook) Ad Account ID, log in to Meta Ads Manager, click the dropdown menu in the top-left corner, and select your account; the alphanumeric ID will be displayed next to the account name. Alternatively, look for act= followed by a string of numbers in the URL bar while in Ads Manager. Methods to Find Your Ad Account ID:`,
        images: [
            "https://scontent-cph2-1.xx.fbcdn.net/v/t39.2365-6/16684928_422527591419536_2937351472586686464_n.png?stp=dst-webp&_nc_cat=101&ccb=1-7&_nc_sid=e280be&_nc_ohc=NbrAnHbZm9EQ7kNvwEsqz_L&_nc_oc=Adn92XOVrO7JH0o7ZysCBMGU6JaUv_vxIEEIQ5M7J8-u-IDZrrsEL5AhaX_3BpPDDBI&_nc_zt=14&_nc_ht=scontent-cph2-1.xx&_nc_gid=7LMCWam2_ut-XLvHqfbgbQ&oh=00_AfvPMeCApR2kgx_HJF21earthLIJDDtDyMWr21ruLIXTRw&oe=69BBC223",
        ],
    },
    {
        id: "shopify",
        title: "Shopify",
        items: [
            "1. Open the Dev Dashboard.",
            "2. Click Apps and select your app.",
            "3. Click Settings.",
            "4. View or copy your client ID and secret."
        ],
        content: `Your app's client credentials (client ID and client secret) authenticate your app when it requests access to a store's data. You can retrieve your app's client credentials in the Dev Dashboard. Note: the store must have the App installed to their Shopify store. See more here: https://shopify.dev/docs/apps/build/authentication-authorization/client-secrets`,
        images: [
            "https://cdn.shopify.com/shopifycloud/shopify-dev/production/assets/assets/images/apps/dev-dashboard/app-settings-BERWjF61.png",
        ],
    },
    {
        id: "woocommerce",
        title: "WooCommerce",
        items: [
            "1. Go to WooCommerce > Settings > Advanced.",
            "2. Go to the REST API tab and click Add key.",
            "3. Give the key a description for your own reference, choose a user with access to orders etc, and give the key read/write permissions.",
            "4. Click Generate api key.",
            "5. Your keys will be shown - do not close this tab yet, the secret will be hidden if you try to view the key again.",
        ],
        content: `To start using REST API, you first need to generate API keys. See more here: https://developer.woocommerce.com/docs/apis/rest-api/`,
        images: [
            "https://developer.woocommerce.com/wp-content/uploads/2023/12/keys.png"
        ],
    },
    {
        id: "google-ads",
        title: "Google Ads",
        items: [
            "Option A: Top-Right Corner: Once signed in, your 10-digit ID is displayed in the top-right corner.",
            "Option B: Profile Menu: Click your profile picture in the top-right corner to see the ID under 'Account Information'."
        ],
        content: `To find your 10-digit Google Ads customer ID, sign in to your account and look at the top-right corner of the header bar next to your profile picture, where it is listed under account information. Alternatively, click the help icon (?) in the top right corner or click your profile name/avatar. See more here: https://support.google.com/google-ads/answer/1704344?hl=en`,
        images: [
            "https://developers.google.com/static/search-ads/images/logincustomerid_ui_corner.png",
        ],
    },
    {
        id: "search-console",
        title: "Google Search Console",
        items: [
            "1. Open Search Console: Go to Google Search Console and log in.",
            "2. Select Property: If you have multiple, choose the specific property from the top-left dropdown.",
            "3. Go to Settings: Click on Settings in the bottom-left menu sidebar.",
            "4. Users & Permissions: Click on Users and permissions.",
            "5. Add User: Click the blue Add user button.",
            "6. Enter Email & Role:",
            "7. Add the following email: searchmind-apex-google-ads@perfect-victor-481319-r1.iam.gserviceaccount.com",
            "8. Select Owner or Full permissions to grant control over the property.",
        ],
        content: `To give admin (Owner) access in Google Search Console, log in, select your property, and navigate to Settings > Users and permissions > Add user. Enter the email address (must be a Google account) and select Owner or Full permissions to grant control over the property. See more here: https://blogcutter.com/add-users-to-google-search-console-step-by-step-guide-Tx7S`,
        images: [
            "https://storage.googleapis.com/support-forums-api/attachment/thread-135468664-1379209104963956529.png",
        ],
    },
    {
        id: "ga4",
        title: "GA4 (Google Analytics 4) ",
        items: [],
        content: `To be updated.`,
        images: [],
    },
];

export default function GuidesPage() {
    const scrollToId = (e, id) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            try { history.replaceState(null, "", `#${id}`); } catch (e) { }
            el.focus({ preventScroll: true });
        }
    };

    const placeholderSvg = encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='400'><rect width='100%' height='100%' fill='#e2e8f0'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='20' fill='#374151'>Placeholder image</text></svg>"
    );
    const placeholderSrc = `data:image/svg+xml;utf8,${placeholderSvg}`;

    return (
        <div className="w-full">
            <div className="max-w-7xl mx-auto">
                <DashboardHeading title="Integration Guides" label="How to request access & find IDs" right={null} showRight={false} />

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="lg:flex lg:gap-8">
                        <aside className="hidden lg:block w-64 shrink-0">
                            <div className="sticky top-28">
                                <div className="bg-white border border-gray-100 rounded p-4">
                                    <h2 className="text-sm font-medium text-slate-700 mb-3">Table of Contents</h2>
                                    <nav className="space-y-2">
                                        {sections.map((s) => {
                                            const Icon = iconForId(s.id);
                                            return (
                                                <a key={s.id} href={`#${s.id}`} onClick={(e) => scrollToId(e, s.id)} className="flex items-center gap-2 text-slate-600 hover:text-sky-600">
                                                    {Icon ? <Icon className="w-4 h-4 text-slate-500" aria-hidden /> : <span className="w-4" />}
                                                    <span> {s.title}</span>
                                                </a>
                                            );
                                        })}
                                    </nav>
                                </div>
                            </div>
                        </aside>

                        <div className="flex-1">
                            <div className="space-y-6">
                                {sections.map((s) => {
                                    const Icon = iconForId(s.id);
                                    return (
                                        <section id={s.id} key={s.id} className="bg-white border border-gray-100 rounded-lg p-6" tabIndex={-1}>
                                            <div className="flex items-start justify-between">
                                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                                    {Icon ? <Icon className="w-5 h-5 text-slate-500" aria-hidden /> : null}
                                                    {s.title}
                                                </h3>
                                            </div>

                                            <div className="mt-4 text-sm text-slate-700">
                                                <p className="mb-3">{s.content}</p>
                                                <ul className="list-disc ml-5 space-y-1 mb-4">
                                                    {s.items.map((it, idx) => (
                                                        <li key={idx}>{it}</li>
                                                    ))}
                                                </ul>

                                                <details className="bg-slate-50 p-4 rounded border">
                                                    <summary className="cursor-pointer text-sm font-medium">Helpful links & examples</summary>
                                                    <div className="mt-3 text-xs text-slate-600">
                                                        {s?.images?.map((img, idx) => (
                                                            <img key={idx} src={img} alt="placeholder" className="w-full h-auto object-contain rounded" />
                                                        ))}
                                                    </div>
                                                </details>
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function iconForId(id) {
    switch (id) {
        case "meta":
            return FaFacebookSquare;
        case "shopify":
            return SiShopify;
        case "google-ads":
            return SiGoogle;
        case "search-console":
            return FiSearch;
        case "ga4":
            return SiGoogleanalytics;
        case "woocommerce":
            return FaWordpress;
        default:
            return null;
    }
}
