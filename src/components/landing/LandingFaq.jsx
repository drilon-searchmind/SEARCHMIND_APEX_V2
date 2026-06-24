"use client";

import { FAQS } from "./landingData";
import { useLanding } from "./LandingContext";

export default function LandingFaq() {
	const { openFaq, toggleFaq } = useLanding();

	return (
		<section className="apex-landing__faq" aria-labelledby="faq-heading">
			<h2 id="faq-heading" className="apex-landing__faq-title">
				Ofte stillede spørgsmål
			</h2>
			<div className="apex-landing__faq-list">
				{FAQS.map((item, index) => {
					const isOpen = openFaq === index;
					return (
						<div key={item.q} className="apex-landing__faq-item">
							<button
								type="button"
								className="apex-landing__faq-trigger"
								onClick={() => toggleFaq(index)}
								aria-expanded={isOpen}
							>
								{item.q}
								<span className={`apex-landing__faq-icon${isOpen ? " apex-landing__faq-icon--open" : ""}`} aria-hidden>+</span>
							</button>
							<div
								className="apex-landing__faq-answer"
								style={{ maxHeight: isOpen ? "220px" : "0", opacity: isOpen ? 1 : 0 }}
							>
								<p>{item.a}</p>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
