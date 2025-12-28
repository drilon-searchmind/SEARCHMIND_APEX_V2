import React from "react";
import Image from "next/image";
import { FiAtSign } from "react-icons/fi";

export default function TeamMembers({ members = [] }) {
    // If no members provided, show 4 placeholders
    const displayMembers = members.length > 0 ? members : [1, 2, 3, 4, 5].map(i => ({
        id: i,
        name: "Team Member (SEO)",
        image: "/images/users/66beeaec47a55.jpg"
    }));

    return (
        <div className="flex items-center gap-1">
            <p className="text-gray-500 mr-1">Your team</p>
            {displayMembers.map((member, idx) => (
                <div key={member.id || idx} className="relative group">
                    <Image
                        src={member.image}
                        alt={member.name}
                        width={35}
                        height={35}
                        className="rounded-full border-1 border-gray-200 hover:scale-105 transition-transform duration-150"
                    />
                    {/* Optionally show name on hover */}
                    <span className="absolute left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                        {member.name}
                    </span>
                </div>
            ))}
        </div>
    );
}
