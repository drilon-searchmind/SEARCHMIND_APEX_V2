"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

const serviceConfig = {
    "51ed563e-4a2c-489b-9506-be385c49a354": { label: "SEO", color: "#1E2B2B" },
    "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": { label: "PPC", color: "#2b3d3d" },
    "2df85265-d5eb-4e86-a111-5d55623851fa": { label: "PS", color: "#3b5252" },
    "55b3e92d-5972-4246-8160-73d7ba04401a": { label: "EM", color: "#4c6b6b" },
    "28b06356-6f19-4633-bfa4-416c150a562c": { label: "Client Lead", color: "#5e8888" },
};

export default function TeamMembers({ customerId }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!customerId) {
            setMembers([]);
            return;
        }

        const fetchTeamMembers = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await fetch(`/api/clickup-team-members/${customerId}`);
                if (!response.ok) {
                    throw new Error("Failed to fetch team members");
                }
                const data = await response.json();
                console.log({data})
                setMembers(data.members || []);
            } catch (err) {
                console.error("Error fetching team members:", err);
                setError(err.message);
                // Fallback to placeholder members on error
                setMembers([]);
            } finally {
                setLoading(false);
            }
        };

        fetchTeamMembers();
    }, [customerId]);

    const displayMembers = members.length > 0 ? members : [1, 2, 3, 4, 5].map(i => ({
        id: i,
        username: "×",
        service: "None"
    }));

    return (
        <div className="flex items-center gap-1">
            <p className="text-gray-500 mr-1">Your team</p>
            {displayMembers.map((member, idx) => {
                const serviceInfo = serviceConfig[member.service] || { label: member.service, color: "#999" };
                return (
                    <div key={member.id || idx} className="relative group">
                        <div
                            className="rounded-full border-2 hover:scale-105 transition-transform duration-150 flex items-center justify-center"
                            style={{
                                width: "35px",
                                height: "35px",
                                backgroundColor: serviceInfo.color,
                                borderColor: "white",
                                transform: `translateX(-${idx * 10}px)`,
                            }}
                            title={member.username}
                        >
                            {member.avatar ? (
                                <Image
                                    src={member.avatar}
                                    alt={member.username}
                                    width={35}
                                    height={35}
                                    className="rounded-full"
                                />
                            ) : (
                                <span className="text-white text-xs font-bold">
                                    {member.username?.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        {/* Show name and service on hover */}
                        <span className="absolute left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                            {member.username} ({serviceInfo.label})
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
