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
import { useParams } from "next/navigation";

const Sidebar = () => {
    const [dashboardOpen, setDashboardOpen] = useState(true);
    const [serviceOpen, setServiceOpen] = useState(true);
    const [isActiveMenu, setIsActiveMenu] = useState(true);
    const params = useParams();
    const activeCustomerId = params?.customerId;

    return (
        <aside className="flex flex-col xl:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-full transition-all duration-300 ease-in-out z-50 border-r border-gray-200 w-[290px]">
            <div className="py-8 flex justify-start mb-10">
                <Link href="/" className="flex items-center gap-2">
                    <Image
                        src="/images/icons/apex-icon.svg"
                        alt="Apex Icon"
                        width={30}
                        height={30}
                        className="mb-2"
                    />
                    <h3 className="font-bold text-black tracking-[0.25rem] uppercase">Apex</h3>
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
                                    <li className="py-2 px-6 rounded-lg w-full bg-[var(--color-primary-searchmind-lighter)] text-white">
                                        <Link href={`/dashboard/${activeCustomerId}/performance-dashboard`} className="w-full">
                                            <span className="text-[0.9rem] text-white font-semibold">Performance Dashboard</span>
                                        </Link>
                                    </li>
                                    <li className="py-2 px-6 rounded-lg w-full">
                                        <Link href={`/dashboard/${activeCustomerId}/daily-overview`}>
                                            <span className="text-[0.9rem] text-slate-600 font-semibold">Daily Overview</span>
                                        </Link>
                                    </li>
                                    <li className="py-2 px-6 rounded-lg w-full">
                                        <Link href={`/dashboard/${activeCustomerId}/pace-report`}>
                                            <span className="text-[0.9rem] text-slate-600 font-semibold">Pace Report</span>
                                        </Link>
                                    </li>
                                    <li className="py-2 px-6 rounded-lg w-full">
                                        <Link href={`/dashboard/${activeCustomerId}/pnl`}>
                                            <span className="text-[0.9rem] text-slate-600 font-semibold">P&L</span>
                                        </Link>
                                    </li>
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
                                    <li className="py-2 px-6 rounded-lg w-full">
                                        <Link href={`/dashboard/${activeCustomerId}/service-dashboard/seo`}><span className="text-[0.9rem] text-slate-600 font-semibold">SEO</span></Link>
                                    </li>
                                    <li className="py-2 px-6 rounded-lg w-full">
                                        <Link href={`/dashboard/${activeCustomerId}/service-dashboard/ppc`}><span className="text-[0.9rem] text-slate-600 font-semibold">PPC</span></Link>
                                    </li>
                                    <li className="py-2 px-6 rounded-lg w-full">
                                        <Link href={`/dashboard/${activeCustomerId}/service-dashboard/ps`}><span className="text-[0.9rem] text-slate-600 font-semibold">PS</span></Link>
                                    </li>
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
                                    <li className="py-2 px-6 rounded-lg w-full">
                                        <Link href={`/dashboard/${activeCustomerId}/tools/campaign-planner`}><span className="text-[0.9rem] text-slate-600 font-semibold">Campaign Planner</span></Link>
                                    </li>
                                    <li className="py-2 px-6 rounded-lg w-full">
                                        <Link href={`/dashboard/${activeCustomerId}/config`}><span className="text-[0.9rem] text-slate-600 font-semibold">Config</span></Link>
                                    </li>
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