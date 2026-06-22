"use client";

import React from "react";
import StandaloneTopbarShell from "@/components/layout/StandaloneTopbarShell";

export default function NewsLayout({ children }) {
    return <StandaloneTopbarShell>{children}</StandaloneTopbarShell>;
}
