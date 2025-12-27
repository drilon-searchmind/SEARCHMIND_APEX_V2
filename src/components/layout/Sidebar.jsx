import React, { useState } from "react";
import Link from "next/link";
import {
    FiChevronDown,
    FiChevronUp,
    FiSettings,
    FiBarChart,
    FiFolder,
    FiTool,
} from "react-icons/fi";
import Image from "next/image";
import { useParams, usePathname } from "next/navigation";
import SmallLabel from "../ui/SmallLabel";

const NavItem = ({ href, label, activeCustomerId, pathname, subLabel }) => {
    const isActive = pathname === href;
    return (
        <li
            className={
                `py-2 px-6 rounded-lg w-full ` +
                (isActive ? "bg-[var(--color-primary-searchmind-lighter-opacity)]" : "")
            }
        >
            <Link href={href} className="w-full">
                <span className={`flex items-center justify-between text-[0.8rem] font-semibold ${isActive ? "text-[var(--color-primary-searchmind)]" : "text-slate-600"}`}>
                    {label}

                    {subLabel && (
                        <SmallLabel>{subLabel}</SmallLabel>
                    )}
                </span>
            </Link>
        </li>
    );
};

const Sidebar = () => {
    const [dashboardOpen, setDashboardOpen] = useState(true);
    const [serviceOpen, setServiceOpen] = useState(true);
    const [isActiveMenu, setIsActiveMenu] = useState(true);

    const params = useParams();
    const pathname = usePathname();
    const activeCustomerId = params?.customerId;

    return (
        <aside className="flex flex-col xl:mt-0 top-0 px-8 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-full transition-all duration-300 ease-in-out z-50 border-r border-gray-200 w-[300px]">
            <div className="py-8 flex justify-start mb-5">
                <Link href="/" className="flex flex-col gap-0">
                    <Image
                        src="/images/icons/apexlogo-new1.png"
                        alt="Apex Icon"
                        width={100}
                        height={100}
                        className="mb-0"
                    />
                    <p className="text-gray-400">by Searchmind</p>
                </Link>
            </div>

            <div className="">
                <p className="text-gray-400 mb-6">Menu</p>
            </div>

            <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
                <nav className="mb-6">
                    <ul className="space-y-4">
                        {/* Dashboard */}
                        <li>
                            <button
                                className="flex items-center justify-between w-full text-left text-gray-600 hover:text-gray-800"
                                onClick={() => setDashboardOpen(!dashboardOpen)}
                            >
                                <span className="flex items-center text-slate-800 font-bold rounded-lg w-full">
                                    <FiBarChart className="mr-2" /> Dashboard
                                </span>
                                {dashboardOpen ? <FiChevronUp /> : <FiChevronDown />}
                            </button>
                            {dashboardOpen && (
                                <ul className="mt-2 space-y-2 flex flex-col w-full">
                                    <NavItem
                                        href={`/dashboard/${activeCustomerId}/performance-dashboard`}
                                        label="Performance Dashboard"
                                        activeCustomerId={activeCustomerId}
                                        pathname={pathname}
                                    />
                                    <NavItem
                                        href={`/dashboard/${activeCustomerId}/daily-overview`}
                                        label="Daily Overview"
                                        activeCustomerId={activeCustomerId}
                                        pathname={pathname}
                                    />
                                    <NavItem
                                        href={`/dashboard/${activeCustomerId}/tools/pace-report`}
                                        label="Pace Report"
                                        activeCustomerId={activeCustomerId}
                                        pathname={pathname}
                                    />
                                    <NavItem
                                        href={`/dashboard/${activeCustomerId}/pnl`}
                                        label="P&L"
                                        activeCustomerId={activeCustomerId}
                                        pathname={pathname}
                                        subLabel={"WIP"}
                                    />
                                    <NavItem
                                        href={`/dashboard/${activeCustomerId}/ecommerce`}
                                        label="Ecommerce"
                                        activeCustomerId={activeCustomerId}
                                        pathname={pathname}
                                        subLabel={"WIP"}
                                    />
                                    <NavItem
                                        href={`/dashboard/${activeCustomerId}/analytics`}
                                        label="Analytics"
                                        activeCustomerId={activeCustomerId}
                                        pathname={pathname}
                                        subLabel={"WIP"}
                                    />
                                </ul>
                            )}
                        </li>

                        {/* Service Dashboard */}
                        <li>
                            <button
                                className="flex items-center justify-between w-full text-left text-gray-600 hover:text-gray-800"
                                onClick={() => setServiceOpen(!serviceOpen)}
                            >
                                <span className="flex items-center text-slate-800 font-bold rounded-lg">
                                    <FiTool className="mr-2" /> Service Dashboard
                                </span>
                                {serviceOpen ? <FiChevronUp /> : <FiChevronDown />}
                            </button>
                            {serviceOpen && (
                                <ul className="mt-2 space-y-2 flex flex-col w-full">
                                    <NavItem
                                        href={`/dashboard/${activeCustomerId}/service-dashboard/seo`}
                                        label="SEO"
                                        activeCustomerId={activeCustomerId}
                                        pathname={pathname}
                                        subLabel={"WIP"}
                                    />
                                    <NavItem
                                        href={`/dashboard/${activeCustomerId}/service-dashboard/ppc`}
                                        label="PPC"
                                        activeCustomerId={activeCustomerId}
                                        pathname={pathname}
                                    />
                                    <NavItem
                                        href={`/dashboard/${activeCustomerId}/service-dashboard/ps`}
                                        label="PS"
                                        activeCustomerId={activeCustomerId}
                                        pathname={pathname}
                                    />
                                </ul>
                            )}
                        </li>

                        {/* Misc */}
                        <li>
                            <button
                                className="flex items-center justify-between w-full text-left text-gray-600 hover:text-gray-800"
                                onClick={() => setServiceOpen(!serviceOpen)}
                            >
                                <span className="flex items-center text-slate-800 font-bold rounded-lg">
                                    <FiTool className="mr-2" /> Misc
                                </span>
                                {serviceOpen ? <FiChevronUp /> : <FiChevronDown />}
                            </button>
                            {serviceOpen && (
                                <ul className="mt-2 space-y-2 flex flex-col w-full">
                                    <NavItem
                                        href={`/dashboard/${activeCustomerId}/tools/campaign-planner`}
                                        label="Campaign Planner"
                                        activeCustomerId={activeCustomerId}
                                        pathname={pathname}
                                        subLabel={"WIP"}
                                    />
                                    <NavItem
                                        href={`/dashboard/${activeCustomerId}/config`}
                                        label="Config"
                                        activeCustomerId={activeCustomerId}
                                        pathname={pathname}
                                    />
                                    <NavItem
                                        href={`/dashboard/${activeCustomerId}/test-page`}
                                        label="Test Page"
                                        activeCustomerId={activeCustomerId}
                                        pathname={pathname}
                                    />
                                </ul>
                            )}
                        </li>
                    </ul>
                </nav>
            </div>
        </aside>
    );
};

export default Sidebar;