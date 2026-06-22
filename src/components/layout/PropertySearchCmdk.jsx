"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FiSearch } from "react-icons/fi";
import { getCustomerPlatformLabel } from "@/lib/customerPlatformDisplay";

/**
 * Cobalt property switcher — same ⌘K palette as the home page.
 */
export default function PropertySearchCmdk({
    customers = [],
    activeCustomerId,
    activeCustomerName,
    buildHref,
    extraItems = [],
    placeholder = "Search properties…",
    showCurrentProperty = true,
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef(null);

    const cmdkItems = useMemo(() => {
        const q = query.trim().toLowerCase();
        const fromCustomers = customers
            .filter((c) => !q || c.customerName?.toLowerCase().includes(q))
            .map((c) => ({
                id: String(c._id),
                name: c.customerName,
                platform: getCustomerPlatformLabel(c),
                href: buildHref ? buildHref(c._id) : `/dashboard/${c._id}/performance-dashboard`,
            }));

        const extras = extraItems
            .filter((item) => !q || item.name?.toLowerCase().includes(q))
            .map((item) => ({
                id: item.id,
                name: item.name,
                platform: item.platform ?? "",
                href: item.href,
            }));

        return [...extras, ...fromCustomers];
    }, [customers, query, buildHref, extraItems]);

    const openPalette = useCallback(() => {
        setOpen(true);
        setQuery("");
        setActiveIndex(0);
    }, []);

    const closePalette = useCallback(() => {
        setOpen(false);
        setQuery("");
        setActiveIndex(0);
    }, []);

    const selectItem = useCallback(
        (index) => {
            const item = cmdkItems[index];
            if (!item) return;
            closePalette();
            router.push(item.href);
        },
        [cmdkItems, closePalette, router]
    );

    useEffect(() => {
        if (!open) return undefined;
        const t = window.setTimeout(() => inputRef.current?.focus(), 50);
        document.body.style.overflow = "hidden";
        return () => {
            window.clearTimeout(t);
            document.body.style.overflow = "";
        };
    }, [open]);

    useEffect(() => {
        const onKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                if (open) closePalette();
                else openPalette();
                return;
            }
            if (!open) return;
            if (e.key === "Escape") {
                e.preventDefault();
                closePalette();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, Math.max(cmdkItems.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
                e.preventDefault();
                selectItem(activeIndex);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, cmdkItems.length, activeIndex, closePalette, openPalette, selectItem]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const buttonLabel =
        showCurrentProperty && activeCustomerName
            ? activeCustomerName
            : placeholder;

    return (
        <>
            <div className="apex-home__search">
                <button
                    type="button"
                    className="apex-home__search-btn"
                    onClick={openPalette}
                    aria-label={`${placeholder} (Ctrl+K)`}
                >
                    <FiSearch aria-hidden />
                    <span className="apex-dash-search__label">{buttonLabel}</span>
                    <span className="apex-home__search-kbd">
                        <kbd>Ctrl</kbd>
                        <kbd>K</kbd>
                    </span>
                </button>
            </div>

            {mounted &&
                createPortal(
                    <div
                        className={`apex-home__cmdk apex-dash-cmdk${open ? " is-open" : ""}`}
                        aria-hidden={!open}
                    >
                        <button
                            type="button"
                            className="apex-home__cmdk-backdrop"
                            aria-label="Close search"
                            onClick={closePalette}
                        />
                        <div
                            className="apex-home__cmdk-panel"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Search properties"
                        >
                            <div className="apex-home__cmdk-field">
                                <FiSearch aria-hidden />
                                <input
                                    ref={inputRef}
                                    type="search"
                                    placeholder={placeholder}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    aria-label="Filter properties"
                                />
                                <kbd>esc</kbd>
                            </div>
                            <div className="apex-home__cmdk-results" role="listbox">
                                {cmdkItems.length === 0 ? (
                                    <p className="apex-home__cmdk-empty">No matching properties.</p>
                                ) : (
                                    <>
                                        <p className="apex-home__cmdk-group">Properties</p>
                                        {cmdkItems.map((item, index) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                role="option"
                                                aria-selected={index === activeIndex}
                                                className={`apex-home__cmdk-item${
                                                    index === activeIndex ? " is-active" : ""
                                                }${String(item.id) === String(activeCustomerId) ? " is-current" : ""}`}
                                                onMouseEnter={() => setActiveIndex(index)}
                                                onClick={() => selectItem(index)}
                                            >
                                                <span>{item.name}</span>
                                                {item.platform ? (
                                                    <span className="apex-home__cmdk-item-meta">{item.platform}</span>
                                                ) : null}
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                            <div className="apex-home__cmdk-foot">
                                <span>
                                    <kbd>↑</kbd>
                                    <kbd>↓</kbd> navigate
                                </span>
                                <span>
                                    <kbd>↵</kbd> open
                                </span>
                                <span>
                                    <kbd>esc</kbd> close
                                </span>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
