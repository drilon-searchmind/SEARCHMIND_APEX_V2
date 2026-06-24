"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanding } from "./LandingContext";

export default function LandingHeader() {
	const { scrollToSignup } = useLanding();

	return (
		<header className="apex-landing__header">
			<div className="apex-landing__header-inner">
				<Link href="/" className="apex-landing__brand" aria-label="Searchmind Apex">
					<Image
						src="/images/icons/apex-icon-svg.svg"
						alt=""
						width={32}
						height={32}
						priority
					/>
					<span className="apex-landing__brand-name">Searchmind Apex</span>
				</Link>
				<div className="apex-landing__header-actions">
					<Link href="/login" className="apex-landing__link">
						Log ind
					</Link>
					<button type="button" className="apex-landing__btn apex-landing__btn--primary apex-landing__btn--compact" onClick={scrollToSignup}>
						Start gratis
					</button>
				</div>
			</div>
		</header>
	);
}
