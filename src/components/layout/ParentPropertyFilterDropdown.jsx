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
        <div className="apex-parent-filter" ref={ref}>
            <span className="apex-parent-filter__label">Filter group(s)</span>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="apex-parent-filter__trigger"
                >
                    <span className="truncate">
                        {enabledCount} of {childCustomers.length} selected
                    </span>
                    <FiChevronDown
                        className={`w-4 h-4 shrink-0 transition-transform${isOpen ? " rotate-180" : ""}`}
                        aria-hidden
                    />
                </button>
                {isOpen ? (
                    <div className="apex-parent-filter__menu">
                        {childCustomers.length === 0 ? (
                            <p className="apex-parent-empty-note px-3 py-2">No properties</p>
                        ) : (
                            childCustomers.map((customer) => {
                                const isEnabled = enabledProperties[customer._id] !== false;
                                return (
                                    <label key={customer._id} className="apex-parent-filter__option">
                                        <input
                                            type="checkbox"
                                            checked={isEnabled}
                                            onChange={(e) => toggleProperty(customer._id, e.target.checked)}
                                            className="apex-parent-checkbox"
                                        />
                                        <span>{customer.customerName}</span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
