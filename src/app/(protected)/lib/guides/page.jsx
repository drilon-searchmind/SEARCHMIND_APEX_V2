"use client"

import React from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import { FaFacebookSquare } from "react-icons/fa";
import { SiShopify, SiGoogle, SiGoogleanalytics } from "react-icons/si";
import { FiSearch } from "react-icons/fi";

const sections = [
    {
        id: "meta",
        title: "Meta ",
        items: [
            "How to request Business Manager access",
            "Finding the Business Manager ID",
            "Granting ad account access",
        ],
        content: `Steps to request access: 1) Ask the customer to add you to their Business Manager as a Partner with appropriate roles. 2) Ask for the Business Manager ID from Settings > Business Info. 3) Request access to the ad account from Business Settings > Accounts > Ad Accounts.`,
    },
    {
        id: "shopify",
        title: "Shopify / WooCommerce",
        items: [
            "Requesting collaborator access (Shopify)",
            "Getting API credentials",
            "Finding store URL and shop ID",
        ],
        content: `For Shopify: ask the merchant to go to Settings > Users and permissions > Collaborators and add your email (or send a collaborator request). For API keys, create a private app or custom app and share the API key and password/Access token.`,
    },
    {
        id: "google-ads",
        title: "Google Ads",
        items: ["Linking accounts via MCC", "Finding Customer ID", "Granting access roles"],
        content: `Find the Google Ads Customer ID in the top-right of the Ads UI. The customer can grant access (Admin > Account access) or you can send a link request from your Manager (MCC) account.`,
    },
    {
        id: "search-console",
        title: "Google Search Console",
        items: ["Request site ownership or user access", "Finding property ID", "Adding users"],
        content: `Ask the customer to add your email as a user under Settings > Users and permissions. For domain properties, verify via DNS or ask for the verified property owner to add you.`,
    },
    {
        id: "ga4",
        title: "GA4 (Google Analytics 4)",
        items: ["Finding Measurement ID", "Granting Editor or Analyst role", "Linking to Google Ads"],
        content: `GA4 Measurement ID is in Admin > Property > Data Streams. To grant access: Admin > Account Access Management or Property Access Management and add your email with Editor/Analyst role as needed.`,
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
                <DashboardHeading title="Integration Guides" label="How to request access & find IDs" right={null} />

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
                                                        <p className="mb-3">Add platform-specific URLs, screenshots or copy templates here.</p>
                                                        <img src={placeholderSrc} alt="placeholder" className="w-full h-48 object-cover rounded border" />
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
        default:
            return null;
    }
}
