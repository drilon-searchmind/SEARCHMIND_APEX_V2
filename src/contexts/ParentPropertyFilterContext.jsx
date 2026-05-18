"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

const ParentPropertyFilterContext = createContext(null);

export function ParentPropertyFilterProvider({ children }) {
    const [childCustomers, setChildCustomers] = useState([]);
    const [enabledProperties, setEnabledProperties] = useState({});

    const toggleProperty = useCallback((customerId, newState) => {
        const id = String(customerId);
        setEnabledProperties((prev) => ({
            ...prev,
            [id]: newState,
        }));
    }, []);

    return (
        <ParentPropertyFilterContext.Provider
            value={{
                childCustomers,
                setChildCustomers,
                enabledProperties,
                setEnabledProperties,
                toggleProperty,
            }}
        >
            {children}
        </ParentPropertyFilterContext.Provider>
    );
}

export function useParentPropertyFilter() {
    const ctx = useContext(ParentPropertyFilterContext);
    return ctx;
}
