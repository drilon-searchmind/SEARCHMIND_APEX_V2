"use client";

export default function ViewSlot({ active, children }) {
    return (
        <div className={active ? "block min-h-0" : "hidden"} aria-hidden={!active}>
            {children}
        </div>
    );
}
