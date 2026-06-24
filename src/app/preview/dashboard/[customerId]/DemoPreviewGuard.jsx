"use client";

import { useParams, notFound } from "next/navigation";
import { isDemoCustomerId } from "@/lib/demoCustomerId";

export default function DemoPreviewGuard({ children }) {
	const params = useParams();
	const customerId = params?.customerId;

	if (!customerId || !isDemoCustomerId(String(customerId))) {
		notFound();
	}

	return children;
}
