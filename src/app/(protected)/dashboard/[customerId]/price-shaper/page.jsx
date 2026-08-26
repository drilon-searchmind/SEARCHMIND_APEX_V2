"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PriceShaperRedirectPage() {
    const { customerId } = useParams();
    const router = useRouter();

    useEffect(() => {
        if (customerId) {
            router.replace(`/dashboard/${customerId}/price-index`);
        }
    }, [customerId, router]);

    return null;
}
