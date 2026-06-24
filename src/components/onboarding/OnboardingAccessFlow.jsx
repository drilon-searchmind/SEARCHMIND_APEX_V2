"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PlatformIcon, { INTEGRATION_ICONS } from "@/components/landing/platformIcons";
import {
	ONBOARDING_CHANNELS,
	ONBOARDING_CONTACT_EMAIL,
	ONBOARDING_STEPS,
	ONBOARDING_STORAGE_KEY,
	loadOnboardingState,
	saveOnboardingState,
} from "@/lib/onboardingAccessData";
import { formatOnboardingLeadName, parseOnboardingLeadFromQuery } from "@/lib/onboardingLead";
import "./onboarding-access.css";

const ICON_MAP = {
	shopify: "Shopify",
	meta: "Meta",
	"google-ads": "Google Ads",
	klaviyo: "Klaviyo",
	ga4: "GA4",
	pinterest: "Pinterest",
	"bing-ads": "Microsoft Ads",
};

function statusLabel(status) {
	switch (status) {
		case "verified":
			return "Verificeret";
		case "verifying":
			return "Tjekker…";
		case "claimed":
			return "Afventer verificering";
		case "failed":
			return "Kunne ikke verificeres";
		default:
			return "Ikke startet";
	}
}

function CopyButton({ value, label = "Kopiér" }) {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			/* ignore */
		}
	};

	if (!value || value.startsWith("Angives")) return null;

	return (
		<button type="button" className="apex-access__copy" onClick={copy}>
			{copied ? "Kopieret" : label}
		</button>
	);
}

function ChannelCard({ channel, entry, onClaim, onVerify, onFieldChange, onToggleOpen, open }) {
	const status = entry?.status ?? "idle";
	const fields = entry?.fields ?? {};

	return (
		<article className={`apex-access__channel${open ? " apex-access__channel--open" : ""}${status === "verified" ? " apex-access__channel--verified" : ""}`}>
			<button type="button" className="apex-access__channel-trigger" onClick={onToggleOpen} aria-expanded={open}>
				<span className="apex-access__channel-icon">
					<PlatformIcon name={ICON_MAP[channel.id] ?? channel.name} map={INTEGRATION_ICONS} size={20} />
				</span>
				<span className="apex-access__channel-meta">
					<span className="apex-access__channel-name">{channel.name}</span>
					<span className="apex-access__channel-cat">{channel.categoryLabel}</span>
				</span>
				<span className={`apex-access__status apex-access__status--${status}`}>{statusLabel(status)}</span>
				<span className="apex-access__chevron" aria-hidden>{open ? "−" : "+"}</span>
			</button>

			{open ? (
				<div className="apex-access__channel-body">
					<p className="apex-access__channel-summary">{channel.summary}</p>
					<ol className="apex-access__steps">
						{channel.steps.map((step) => (
							<li key={step}>{step}</li>
						))}
					</ol>

					{channel.shareTargets?.length ? (
						<div className="apex-access__targets">
							{channel.shareTargets.map((target) => (
								<div key={target.label} className="apex-access__target">
									<span className="apex-access__target-label">{target.label}</span>
									<code className="apex-access__target-value">{target.value}</code>
									<CopyButton value={target.value} />
								</div>
							))}
						</div>
					) : null}

					{channel.fields?.length ? (
						<div className="apex-access__fields">
							{channel.fields.map((field) => (
								<label key={field.id} className="apex-access__field">
									<span>{field.label}</span>
									<input
										type="text"
										value={fields[field.id] ?? ""}
										placeholder={field.placeholder}
										onChange={(e) => onFieldChange(channel.id, field.id, e.target.value)}
									/>
								</label>
							))}
						</div>
					) : null}

					<div className="apex-access__channel-actions">
						{status === "idle" || status === "failed" ? (
							<button type="button" className="apex-access__btn apex-access__btn--secondary" onClick={() => onClaim(channel.id)}>
								Jeg har givet adgang
							</button>
						) : null}
						{status === "claimed" || status === "failed" ? (
							<button
								type="button"
								className="apex-access__btn apex-access__btn--primary"
								onClick={() => onVerify(channel.id)}
								disabled={status === "verifying"}
							>
								Verificer adgang
							</button>
						) : null}
						{status === "verified" ? (
							<p className="apex-access__verified-note">Adgang registreret — Searchmind kan nu tilkoble kanalen.</p>
						) : null}
					</div>
				</div>
			) : null}
		</article>
	);
}

export default function OnboardingAccessFlow() {
	const [channels, setChannels] = useState({});
	const [openId, setOpenId] = useState(ONBOARDING_CHANNELS[0]?.id ?? null);
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState("");
	const [created, setCreated] = useState(false);
	const [lead, setLead] = useState({
		email: "",
		fornavn: "",
		efternavn: "",
		tlf: "",
		virksomhed: "",
	});

	useEffect(() => {
		setChannels(loadOnboardingState());
		if (typeof window !== "undefined") {
			setLead(parseOnboardingLeadFromQuery(new URLSearchParams(window.location.search)));
		}
	}, []);

	const persist = useCallback((next) => {
		setChannels(next);
		saveOnboardingState(next);
	}, []);

	const verifiedCount = useMemo(
		() => Object.values(channels).filter((c) => c.status === "verified").length,
		[channels]
	);

	const updateChannel = useCallback(
		(id, patch) => {
			persist({
				...channels,
				[id]: { ...channels[id], fields: channels[id]?.fields ?? {}, ...patch },
			});
		},
		[channels, persist]
	);

	const onFieldChange = useCallback(
		(channelId, fieldId, value) => {
			updateChannel(channelId, {
				fields: { ...(channels[channelId]?.fields ?? {}), [fieldId]: value },
			});
		},
		[channels, updateChannel]
	);

	const onClaim = useCallback(
		(channelId) => {
			updateChannel(channelId, { status: "claimed" });
		},
		[updateChannel]
	);

	const onVerify = useCallback((channelId) => {
		updateChannel(channelId, { status: "verifying" });
		window.setTimeout(() => {
			setChannels((prev) => {
				const next = {
					...prev,
					[channelId]: {
						fields: prev[channelId]?.fields ?? {},
						...prev[channelId],
						status: "verified",
						verifiedAt: new Date().toISOString(),
					},
				};
				saveOnboardingState(next);
				return next;
			});
		}, 1400);
	}, [updateChannel]);

	const onCreate = async () => {
		setCreating(true);
		setCreateError("");
		try {
			const channelPayload = ONBOARDING_CHANNELS.map((channel) => {
				const entry = channels[channel.id] ?? { status: "idle", fields: {} };
				return {
					channelId: channel.id,
					channelName: channel.name,
					status: entry.status ?? "idle",
					fields: entry.fields ?? {},
					verifiedAt: entry.verifiedAt ?? null,
				};
			});

			const res = await fetch("/api/onboarding/requests", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ lead, channels: channelPayload }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data.error || "Kunne ikke oprette Apex-konto");
			}

			setCreated(true);
			try {
				window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
			} catch {
				/* ignore */
			}
		} catch (err) {
			setCreateError(err.message || "Kunne ikke oprette Apex-konto");
		} finally {
			setCreating(false);
		}
	};

	const leadName = formatOnboardingLeadName(lead);

	const recommended = ONBOARDING_CHANNELS.filter((c) => c.recommended);
	const optional = ONBOARDING_CHANNELS.filter((c) => !c.recommended);

	if (created) {
		return (
			<div className="apex-access" data-theme="cobalt">
				<div className="apex-access__success">
					<p className="apex-access__eyebrow">Konto oprettes</p>
					<h1 className="apex-access__title">Tak — vi er i gang</h1>
					<p className="apex-access__lede">
						Jeres Apex-konto oprettes med de kanaler, I har verificeret. Searchmind-teamet kontakter jer, hvis vi mangler noget.
					</p>
					<Link href="/" className="apex-access__btn apex-access__btn--primary">
						Tilbage til forsiden
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="apex-access" data-theme="cobalt">
			<header className="apex-access__header">
				<div className="apex-access__header-inner">
					<Link href="/" className="apex-access__brand">
						<Image src="/images/icons/apex-icon-svg.svg" alt="" width={32} height={32} />
						<span>Searchmind Apex</span>
					</Link>
					<Link href="/#kontakt" className="apex-access__back">
						← Tilbage
					</Link>
				</div>
			</header>

			<main className="apex-access__main">
				<div className="apex-access__intro">
					<p className="apex-access__eyebrow">Onboarding · trin 2</p>
					<h1 className="apex-access__title">Giv Apex adgang til jeres kanaler</h1>
					<p className="apex-access__lede">
						Apex kræver partner-adgang til jeres data — vi har endnu ikke self-service OAuth. Følg guiden for hver kanal,
						giv adgang som beskrevet, og verificer når I er klar. Minimum én kanal skal være verificeret før vi opretter kontoen.
					</p>
					{lead.email || leadName ? (
						<p className="apex-access__lead">
							Formular modtaget
							{leadName ? <> for <strong>{leadName}</strong></> : null}
							{lead.virksomhed ? <> ({lead.virksomhed})</> : null}
							{lead.email ? <> — {lead.email}</> : null}
							{lead.tlf ? <> · {lead.tlf}</> : null}
						</p>
					) : null}

					<ol className="apex-access__progress" aria-label="Onboarding trin">
						{ONBOARDING_STEPS.map((step, i) => (
							<li
								key={step.id}
								className={`apex-access__progress-step${step.id === "access" ? " apex-access__progress-step--current" : ""}${step.id === "form" ? " apex-access__progress-step--done" : ""}`}
							>
								<span className="apex-access__progress-num">{i + 1}</span>
								<span>{step.label}</span>
							</li>
						))}
					</ol>
				</div>

				<div className="apex-access__layout">
					<section className="apex-access__channels" aria-labelledby="channels-rec-heading">
						<h2 id="channels-rec-heading" className="apex-access__section-title">
							Anbefalede kanaler
						</h2>
						<p className="apex-access__section-lede">Start med webshop og paid media — flere kanaler kan tilføjes senere.</p>
						<div className="apex-access__channel-list">
							{recommended.map((channel) => (
								<ChannelCard
									key={channel.id}
									channel={channel}
									entry={channels[channel.id]}
									open={openId === channel.id}
									onToggleOpen={() => setOpenId(openId === channel.id ? null : channel.id)}
									onClaim={onClaim}
									onVerify={onVerify}
									onFieldChange={onFieldChange}
								/>
							))}
						</div>

						{optional.length ? (
							<>
								<h2 className="apex-access__section-title apex-access__section-title--spaced">Valgfrie kanaler</h2>
								<div className="apex-access__channel-list">
									{optional.map((channel) => (
										<ChannelCard
											key={channel.id}
											channel={channel}
											entry={channels[channel.id]}
											open={openId === channel.id}
											onToggleOpen={() => setOpenId(openId === channel.id ? null : channel.id)}
											onClaim={onClaim}
											onVerify={onVerify}
											onFieldChange={onFieldChange}
										/>
									))}
								</div>
							</>
						) : null}
					</section>

					<aside className="apex-access__aside">
						<div className="apex-access__aside-card">
							<p className="apex-access__aside-label">Status</p>
							<p className="apex-access__aside-count">
								{verifiedCount}
								<span> / {ONBOARDING_CHANNELS.length} kanaler verificeret</span>
							</p>
							<p className="apex-access__aside-hint">
								{verifiedCount === 0
									? "Verificer mindst én kanal for at oprette jeres Apex-konto."
									: "I kan oprette kontoen nu — Searchmind tilkobler resten løbende."}
							</p>
							<button
								type="button"
								className="apex-access__btn apex-access__btn--primary apex-access__btn--block"
								disabled={verifiedCount < 1 || creating}
								onClick={onCreate}
							>
								{creating ? "Opretter…" : "Opret Apex-konto"}
							</button>
							{createError ? (
								<p className="apex-access__create-error" role="alert">{createError}</p>
							) : null}
						</div>
						<div className="apex-access__aside-card apex-access__aside-help">
							<p className="apex-access__aside-help-text">
								Har du brug for hjælp? Kontakt os her:{" "}
								<a href={`mailto:${ONBOARDING_CONTACT_EMAIL}`}>{ONBOARDING_CONTACT_EMAIL}</a>
							</p>
							<a
								href={`mailto:${ONBOARDING_CONTACT_EMAIL}?subject=Apex%20onboarding%20%E2%80%94%20hj%C3%A6lp%20med%20adgang`}
								className="apex-access__btn apex-access__btn--secondary apex-access__btn--block"
							>
								Kontakt os
							</a>
						</div>
					</aside>
				</div>
			</main>
		</div>
	);
}
