"use client";

import React from "react";
import StandaloneTopbarShell from "@/components/layout/StandaloneTopbarShell";

export default function AdminPageLayout({ children }) {
    return <StandaloneTopbarShell>{children}</StandaloneTopbarShell>;
}
