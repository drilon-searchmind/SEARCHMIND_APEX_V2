"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import Image from "next/image";
import { FiCheck, FiInfo, FiX } from "react-icons/fi";

const TeamMembersDataContext = createContext(null);

/**
 * Single source for ClickUp team fetch + animation key.
 * Topbar mounts <TeamMembers /> twice (desktop + mobile); without this, each instance
 * fetches and bumps avatarAnimKey → repeated animations and duplicate API calls.
 */
export function ClickupTeamMembersProvider({
    customerId,
    enabled = true,
    children,
}) {
    const [members, setMembers] = useState([]);
    const [customerServices, setCustomerServices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [avatarAnimKey, setAvatarAnimKey] = useState(0);

    useEffect(() => {
        if (!enabled || !customerId) {
            setMembers([]);
            setCustomerServices([]);
            setAvatarAnimKey(0);
            setLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                const response = await fetch(
                    `/api/clickup-team-members/${customerId}`
                );
                if (cancelled) return;
                if (!response.ok) {
                    throw new Error("Failed to fetch team members");
                }
                const data = await response.json();
                if (cancelled) return;
                setMembers(data.members || []);
                setCustomerServices(data.customerServices || []);
                setAvatarAnimKey((k) => k + 1);
            } catch (err) {
                if (cancelled) return;
                console.error("Error fetching team members:", err);
                setMembers([]);
                setCustomerServices([]);
                setAvatarAnimKey((k) => k + 1);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [customerId, enabled]);

    const value = useMemo(
        () => ({
            members,
            customerServices,
            loading,
            avatarAnimKey,
            customerId: enabled ? customerId : null,
        }),
        [members, customerServices, loading, avatarAnimKey, customerId, enabled]
    );

    return (
        <TeamMembersDataContext.Provider value={value}>
            {children}
        </TeamMembersDataContext.Provider>
    );
}

function useTeamMembersData() {
    const ctx = useContext(TeamMembersDataContext);
    if (!ctx) {
        throw new Error(
            "TeamMembers must be used inside ClickupTeamMembersProvider"
        );
    }
    return ctx;
}

function MemberFace({ member }) {
    const [imgError, setImgError] = useState(false);
    useEffect(() => {
        setImgError(false);
    }, [member.avatar, member.id]);
    const showImage = Boolean(member.avatar) && !imgError;

    return (
        <>
            {showImage ? (
                <Image
                    src={member.avatar}
                    alt={member.username || ""}
                    width={35}
                    height={35}
                    className="rounded-full object-cover"
                    sizes="35px"
                    onError={() => setImgError(true)}
                />
            ) : (
                <span className="text-white text-xs font-bold">
                    {(member.username && member.username !== "×"
                        ? member.username.charAt(0)
                        : "×"
                    ).toUpperCase()}
                </span>
            )}
        </>
    );
}

const serviceConfig = {
    "51ed563e-4a2c-489b-9506-be385c49a354": { label: "SEO", color: "#1E2B2B" },
    "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": { label: "PPC", color: "#2b3d3d" },
    "2df85265-d5eb-4e86-a111-5d55623851fa": { label: "PS", color: "#3b5252" },
    "55b3e92d-5972-4246-8160-73d7ba04401a": { label: "EM", color: "#4c6b6b" },
    "28b06356-6f19-4633-bfa4-416c150a562c": { label: "Client Lead", color: "#5e8888" },
};

function memberRoleLabel(member) {
    const s = serviceConfig[member.service];
    return s?.label ?? member.service ?? "—";
}

/** Hover panel: team names + contract services (check / X). */
function TeamServicesPopover({ services, members, open }) {
    if (!open) return null;
    const hasTeam = members?.length > 0;
    const hasServices = services?.length > 0;
    if (!hasTeam && !hasServices) return null;

    return (
        <div
            className="absolute right-0 top-full z-[100] mt-1.5 flex max-w-[min(92vw,22rem)] gap-3 rounded-md border border-gray-200/90 bg-white/98 py-2 pl-2.5 pr-2.5 shadow-sm backdrop-blur-[2px]"
            role="tooltip"
        >
            {hasTeam && (
                <div
                    className={`min-w-0 shrink-0 ${hasServices ? "border-r border-gray-100 pr-3" : ""}`}
                >
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Team
                    </p>
                    <ul className="space-y-1.5" aria-label="Team members">
                        {members.map((m) => (
                            <li
                                key={String(m.id)}
                                className="text-[11px] leading-tight text-gray-700"
                            >
                                <span className="font-medium text-gray-800">
                                    {m.username}
                                </span>
                                <span className="text-gray-500">
                                    {" "}
                                    ({memberRoleLabel(m)})
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {hasServices && (
                <div className="min-w-0 flex-1">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Services by Searchmind
                    </p>
                    <ul className="space-y-1" aria-label="Contract services">
                        {services.map((s) => (
                            <li
                                key={s.key}
                                className="flex items-center gap-2 text-[11px] leading-tight text-gray-600"
                            >
                                <span className="flex shrink-0 items-center justify-center">
                                    {s.active ? (
                                        <FiCheck
                                            className="h-3 w-3 text-emerald-600/75"
                                            aria-hidden
                                        />
                                    ) : (
                                        <FiX
                                            className="h-3 w-3 text-gray-400/90"
                                            aria-hidden
                                        />
                                    )}
                                </span>
                                <span className="min-w-0">{s.label}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default function TeamMembers() {
    const { members, customerServices, loading, avatarAnimKey, customerId } =
        useTeamMembersData();
    const [servicesOpen, setServicesOpen] = useState(false);

    const hasServiceData = customerServices.length > 0;
    const hasTeamMembers = members.length > 0;
    const showPopoverContent = hasServiceData || hasTeamMembers;

    const displayMembers =
        members.length > 0
            ? members
            : [1, 2, 3, 4, 5].map((i) => ({
                  id: i,
                  username: "×",
                  service: "None",
              }));

    const keyBase = customerId ?? "none";
    const totalMembers = displayMembers.length;

    const renderMemberAvatar = (member, idx) => {
        const serviceInfo = serviceConfig[member.service] || {
            label: member.service,
            color: "#999",
        };
        const uniqueKey = `member-${member.id || `placeholder-${idx}`}-${idx}`;
        const isLast = idx === totalMembers - 1;
        return (
            <div
                key={uniqueKey}
                className="animate-team-member-in relative w-[35px] shrink-0"
                style={{ animationDelay: `${idx * 52}ms` }}
                id={uniqueKey}
            >
                {isLast && hasServiceData && (
                    <span
                        className="pointer-events-none absolute top-1/2 z-[5] -translate-y-1/2 translate-x-1 text-gray-400"
                        style={{ right: "calc(100% - 4px)" }}
                        aria-hidden
                    >
                        <FiInfo className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                )}
                <div
                    className="flex h-[35px] w-[35px] items-center justify-center rounded-full border-2 border-white transition-transform duration-150 hover:scale-105"
                    style={{
                        backgroundColor: serviceInfo.color,
                        transform: `translateX(-${idx * 12}px)`,
                    }}
                >
                    <MemberFace member={member} />
                </div>
            </div>
        );
    };

    return (
        <div
            className="relative flex min-w-0 items-center gap-1 sm:gap-1.5"
            onMouseEnter={() => hasServiceData && setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
        >
            <p className="mr-0.5 shrink-0 text-sm text-gray-500">Team</p>
            <div
                className="flex items-center gap-1"
                key={`${keyBase}-${avatarAnimKey}`}
                aria-busy={loading}
            >
                {displayMembers.map((member, idx) =>
                    renderMemberAvatar(member, idx)
                )}
            </div>
            <TeamServicesPopover
                services={customerServices}
                members={members}
                open={servicesOpen && showPopoverContent}
            />
        </div>
    );
}
