"use client";

import React, { useState, useRef, useEffect } from "react";
import { FiChevronDown } from "react-icons/fi";
import { useParentPropertyFilter } from "@/contexts/ParentPropertyFilterContext";

export default function ParentPropertyFilterDropdown() {
    const { childCustomers, enabledProperties, toggleProperty } = useParentPropertyFilter();
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const enabledCount = childCustomers.filter((c) => enabledProperties[c._id] !== false).length;

    return (
        <div className="flex items-center gap-2" ref={ref}>
            <span className="text-sm text-gray-600 whitespace-nowrap">Filter group(s)</span>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between gap-2 min-w-[140px] px-3 py-2 text-sm text-left bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors"
                >
                    <span className="text-gray-700 truncate">
                        {enabledCount} of {childCustomers.length} selected
                    </span>
                    <FiChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                    <div className="absolute right-0 mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2">
                        {childCustomers.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500">No properties</div>
                        ) : (
                            childCustomers.map((customer) => {
                                const isEnabled = enabledProperties[customer._id] !== false;
                                return (
                                    <label
                                        key={customer._id}
                                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isEnabled}
                                            onChange={(e) => toggleProperty(customer._id, e.target.checked)}
                                            className="rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)]"
                                        />
                                        <span className="text-sm text-gray-800 truncate">{customer.customerName}</span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
