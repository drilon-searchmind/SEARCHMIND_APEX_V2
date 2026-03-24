"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import Image from "next/image";

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
    const [loading, setLoading] = useState(false);
    const [avatarAnimKey, setAvatarAnimKey] = useState(0);

    useEffect(() => {
        if (!enabled || !customerId) {
            setMembers([]);
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
                setAvatarAnimKey((k) => k + 1);
            } catch (err) {
                if (cancelled) return;
                console.error("Error fetching team members:", err);
                setMembers([]);
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
            loading,
            avatarAnimKey,
            customerId: enabled ? customerId : null,
        }),
        [members, loading, avatarAnimKey, customerId, enabled]
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

export default function TeamMembers() {
    const { members, loading, avatarAnimKey, customerId } = useTeamMembersData();

    const displayMembers =
        members.length > 0
            ? members
            : [1, 2, 3, 4, 5].map((i) => ({
                  id: i,
                  username: "×",
                  service: "None",
              }));

    const keyBase = customerId ?? "none";

    return (
        <div className="flex items-center gap-1">
            <p className="text-gray-500 mr-1 text-sm">Team</p>
            <div
                className="flex items-center gap-1"
                key={`${keyBase}-${avatarAnimKey}`}
                aria-busy={loading}
            >
                {displayMembers.map((member, idx) => {
                    const serviceInfo = serviceConfig[member.service] || {
                        label: member.service,
                        color: "#999",
                    };
                    const uniqueKey = `member-${member.id || `placeholder-${idx}`}-${idx}`;
                    return (
                        <div
                            key={uniqueKey}
                            className="relative group animate-team-member-in"
                            style={{ animationDelay: `${idx * 52}ms` }}
                            id={uniqueKey}
                        >
                            <div
                                className="rounded-full border-2 hover:scale-105 transition-transform duration-150 flex items-center justify-center"
                                style={{
                                    width: "35px",
                                    height: "35px",
                                    backgroundColor: serviceInfo.color,
                                    borderColor: "white",
                                    transform: `translateX(-${idx * 12}px)`,
                                }}
                                title={member.username}
                            >
                                <MemberFace member={member} />
                            </div>
                            <span className="absolute left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                                {member.username} ({serviceInfo.label})
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
