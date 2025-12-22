import React, { useState } from "react";
import Image from "next/image";
import { FaMoon, FaSun } from "react-icons/fa";
import { FiChevronDown, FiUser, FiSettings, FiBarChart2, FiLogOut } from "react-icons/fi";
import { useUser } from "@/contexts/UserContext";
import { signOut } from "next-auth/react";

const Topbar = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const user = useUser();
    const [theme, setTheme] = useState("light");

    const handleToggleTheme = () => {
        setTheme(theme === "light" ? "dark" : "light");
    };

    return (
        <div className="sticky top-0 bg-white flex items-center justify-between px-8 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-4">
                <input
                    type="text"
                    placeholder="Search..."
                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div className="flex items-center space-x-4">
                <button onClick={handleToggleTheme} className="p-2 rounded-full border border-gray-200">
                    {theme === "dark" ? <FaSun /> : <FaMoon />}
                </button>
                <div className="relative">
                    <button
                        className="flex items-center space-x-2"
                        onClick={() => setMenuOpen(!menuOpen)}
                    >
                        <Image
                            src={user?.image || "/images/users/66beeaec47a55.jpg"}
                            alt="User"
                            width={32}
                            height={32}
                            className="rounded-full"
                        />
                        <span>{user?.name || "User"}</span>
                        <FiChevronDown className="ml-2" />
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 mt-[22px] w-75 bg-white shadow-xs rounded-[1rem] px-4 overflow-hidden z-50 py-4 border border-gray-200">
                            <div className="mb-4">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold">{user?.name}</p>
                                    {user?.isAdmin && (
                                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-1">
                                            Admin
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-400 text-xs">{user?.email}</p>

                                {user?.isExternal && (
                                    <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mt-1 ml-1">
                                        External
                                    </span>
                                )}
                            </div>

                            <ul className="flex flex-col gap-4 py-2">
                                <li className="flex items-center gap-2">
                                    <FiUser />
                                    <a href="/profile" className="text-sm text-slate-800 font-semibold">User Profile</a>
                                </li>
                                <li className="flex items-center gap-2">
                                    <FiSettings />
                                    <a href="/profile" className="text-sm text-slate-800 font-semibold">Admin</a>
                                </li>
                                <li className="flex items-center gap-2">
                                    <FiBarChart2 />
                                    <a href="/profile" className="text-sm text-slate-800 font-semibold">Campaigns</a>
                                </li>
                                <hr className="text-gray-200" />
                                <li className="flex items-center gap-2">
                                    <FiLogOut />
                                    <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-sm text-slate-800 font-semibold">Sign Out</button>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Topbar;