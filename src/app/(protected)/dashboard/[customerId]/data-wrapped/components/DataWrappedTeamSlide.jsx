"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

export const TEAM_SERVICE_CONFIG = {
    "51ed563e-4a2c-489b-9506-be385c49a354": { label: "SEO", color: "#1E2B2B" },
    "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": { label: "PPC", color: "#2b3d3d" },
    "2df85265-d5eb-4e86-a111-5d55623851fa": { label: "PS", color: "#3b5252" },
    "55b3e92d-5972-4246-8160-73d7ba04401a": { label: "EM", color: "#4c6b6b" },
    "28b06356-6f19-4633-bfa4-416c150a562c": { label: "Client Lead", color: "#5e8888" },
};

/** Team slide — shared by DataWrappedModal and DataWrappedModalMaskScroll */
export function TeamSlideContent({ customerId, compact = false }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!customerId) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        fetch(`/api/clickup-team-members/${customerId}`)
            .then((res) => (res.ok ? res.json() : { members: [] }))
            .then((data) => {
                if (!cancelled) setMembers(data.members || []);
            })
            .catch(() => {
                if (!cancelled) setMembers([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [customerId]);

    const displayMembers =
        members.length > 0 ? members : [1, 2, 3, 4, 5].map((i) => ({ id: i, username: "Team member", service: "None" }));

    const size = compact ? 100 : 180;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center text-center px-4">
                <p className="text-[var(--color-lime)] text-xs md:text-sm font-medium tracking-[0.2em] uppercase mb-4">
                    Your Team
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center text-center px-4 max-h-full overflow-y-auto pointer-events-auto">
            <p className="text-[var(--color-lime)] text-xs md:text-sm font-medium tracking-[0.2em] uppercase mb-3 md:mb-6">
                Your Team
            </p>
            <h2 className={`font-bold text-white mb-4 md:mb-8 ${compact ? "text-lg md:text-2xl" : "text-2xl md:text-3xl"}`}>
                The people behind your success
            </h2>
            <div className="flex flex-wrap justify-center gap-4 md:gap-8 lg:gap-12">
                {displayMembers.map((member, idx) => {
                    const serviceInfo = TEAM_SERVICE_CONFIG[member.service] || {
                        label: member.service || "Team",
                        color: "#406969",
                    };
                    return (
                        <div key={member.id || idx} className="flex flex-col items-center gap-2 md:gap-3">
                            <div
                                className="rounded-full border-4 flex items-center justify-center overflow-hidden shrink-0"
                                style={{
                                    width: size,
                                    height: size,
                                    borderColor: "rgba(255,255,255,0.3)",
                                    backgroundColor: serviceInfo.color,
                                }}
                            >
                                {member.avatar ? (
                                    <Image
                                        src={member.avatar}
                                        alt={member.username}
                                        width={size}
                                        height={size}
                                        className="object-cover w-full h-full"
                                    />
                                ) : (
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.username || "?")}&size=360&background=${serviceInfo.color.replace("#", "")}&color=fff`}
                                        alt={member.username}
                                        width={size}
                                        height={size}
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>
                            <div className="text-center max-w-[140px]">
                                <p className="text-white font-semibold text-sm md:text-lg leading-tight">
                                    {member.username || "Team member"}
                                </p>
                                <p className="text-[var(--color-primary-searchmind-lighter)] text-xs md:text-sm">
                                    {serviceInfo.label}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
