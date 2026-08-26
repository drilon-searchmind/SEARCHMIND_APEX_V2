"use client";

import { useCallback, useState } from "react";
import { addRecentCustomerId, readRecentCustomerIds } from "@/lib/recentCustomers";

export function useRecentCustomers() {
    const [recentIds, setRecentIds] = useState([]);

    const refreshRecentIds = useCallback(() => {
        setRecentIds(readRecentCustomerIds());
    }, []);

    const recordRecentCustomer = useCallback((customerId) => {
        setRecentIds(addRecentCustomerId(customerId));
    }, []);

    return { recentIds, refreshRecentIds, recordRecentCustomer };
}
