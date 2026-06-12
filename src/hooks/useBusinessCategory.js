import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import {
    getBusinessCategory,
    isB2BCustomer,
    isEcommerceCustomer,
    getBusinessCategoryLabel,
} from "@/lib/customerBusinessCategory";

/**
 * Resolves the active customer's business category from route + customers list.
 * @param {Record<string, unknown> | null | undefined} [customerOverride]
 */
export function useBusinessCategory(customerOverride) {
    const params = useParams();
    const { customers } = useCustomers();

    const customer = useMemo(() => {
        if (customerOverride) return customerOverride;
        const id = params?.customerId;
        if (!id) return null;
        return customers.find((c) => String(c._id) === String(id)) || null;
    }, [customerOverride, customers, params?.customerId]);

    return useMemo(
        () => ({
            customer,
            businessCategory: getBusinessCategory(customer),
            isB2B: isB2BCustomer(customer),
            isEcommerce: isEcommerceCustomer(customer),
            businessCategoryLabel: getBusinessCategoryLabel(customer),
        }),
        [customer]
    );
}
