"use client";

import { useEffect, useState } from "react";

export default function ViewSlot({ active, children }) {
    const [mounted, setMounted] = useState(active);

    useEffect(() => {
        if (active) setMounted(true);
    }, [active]);

    if (!mounted) return null;

    return (
        <div className={active ? "block min-h-0" : "hidden"} aria-hidden={!active}>
            {children}
        </div>
    );
}
