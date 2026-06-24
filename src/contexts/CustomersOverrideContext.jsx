"use client";

import { createContext, useContext } from "react";

/** When set (preview embed), useCustomers returns this instead of fetching all customers. */
export const CustomersOverrideContext = createContext(null);

export function useCustomersOverride() {
	return useContext(CustomersOverrideContext);
}
