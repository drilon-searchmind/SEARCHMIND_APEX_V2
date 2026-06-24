"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CustomersOverrideContext } from "@/contexts/CustomersOverrideContext";

export default function PreviewCustomersProvider({ children }) {
	const params = useParams();
	const customerId = params?.customerId;
	const [customers, setCustomers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		if (!customerId) return undefined;
		let cancelled = false;

		(async () => {
			try {
				setLoading(true);
				setError(null);
				const res = await fetch(`/api/customers/${customerId}`);
				if (!res.ok) throw new Error("Failed to load demo customer");
				const customer = await res.json();
				if (!cancelled) setCustomers([customer]);
			} catch (err) {
				if (!cancelled) {
					setError(err.message);
					setCustomers([]);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [customerId]);

	const value = useMemo(
		() => ({
			customers,
			loading,
			error,
			fetchCustomers: async () => {},
			createCustomer: async () => {
				throw new Error("Not available in preview");
			},
			updateCustomer: async () => {
				throw new Error("Not available in preview");
			},
			deleteCustomer: async () => {
				throw new Error("Not available in preview");
			},
		}),
		[customers, loading, error]
	);

	return (
		<CustomersOverrideContext.Provider value={value}>
			{children}
		</CustomersOverrideContext.Provider>
	);
}
