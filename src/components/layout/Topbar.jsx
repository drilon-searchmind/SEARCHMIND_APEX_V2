import React, { useState } from "react";
import Image from "next/image";
import { FaMoon, FaSun } from "react-icons/fa";
import { FiChevronDown, FiHome, FiUser, FiSettings, FiBarChart2, FiLogOut, FiSearch, FiUsers } from "react-icons/fi";
import { useUser } from "@/contexts/UserContext";
import { signOut } from "next-auth/react";
import { useCustomers } from "@/hooks/useCustomers";
import { useParams, useRouter } from "next/navigation";
import Select from 'react-select';
import TeamMembers from './TeamMembers';
import SharePropertyModal from '@/components/dashboard/SharePropertyModal';
import Link from "next/link";
import FormButton from "../form/FormButton";

const Topbar = ({ showLinks = true, showLogo = false }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const user = useUser();
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') || 'light';
        }
        return 'light';
    });
    const { customers } = useCustomers();
    const params = useParams();
    const router = useRouter();
    const activeCustomerId = params?.customerId;

    // Dynamic access control: if user is external, only show shared customers; else show all
    let accessibleCustomers = customers;
    if (user?.isExternal) {
        const sharedCustomerIds = (user.sharedCustomers || []).map(
            id => typeof id === 'object' && id.$oid ? id.$oid : String(id)
        );
        accessibleCustomers = customers.filter(c => sharedCustomerIds.includes(String(c._id)));
    }
    // Share property modal state
    const [showShareModal, setShowShareModal] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [shareLoading, setShareLoading] = useState(false);
    const [shareError, setShareError] = useState("");
    React.useEffect(() => {
        if (!user?.isExternal && showShareModal) {
            fetch('/api/users?externalOnly=true')
                .then(res => res.ok ? res.json() : [])
                .then(data => setAllUsers(data))
                .catch(() => setAllUsers([]));
        }
    }, [showShareModal, user]);

    // Share handler (supports add and remove)
    const handleShareProperty = async (toAdd = [], toRemove = []) => {
        setShareLoading(true);
        setShareError("");
        const customerId = activeCustomerId;
        try {
            // Add access
            await Promise.all((toAdd || []).map(async (userId) => {
                await fetch('/api/users', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, customerId, action: 'add' })
                });
            }));
            // Remove access
            await Promise.all((toRemove || []).map(async (userId) => {
                await fetch('/api/users', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, customerId, action: 'remove' })
                });
            }));
            setShowShareModal(false);
        } catch (err) {
            setShareError('Failed to update sharing.');
        } finally {
            setShareLoading(false);
        }
    };

    // Prepare options for react-select
    const customerOptions = accessibleCustomers.map((customer) => ({
        value: customer._id,
        label: `${customer.customerName}`,
        customer: customer
    }));

    // Check if activeCustomerId is accessible, if not redirect to first accessible customer
    const isActiveCustomerAccessible = accessibleCustomers.some(c => c._id === activeCustomerId);
    React.useEffect(() => {
        if (activeCustomerId && !isActiveCustomerAccessible && accessibleCustomers.length > 0) {
            // Redirect to first accessible customer if current one is not accessible
            router.push(`/dashboard/${accessibleCustomers[0]._id}/performance-dashboard`);
        }
    }, [activeCustomerId, isActiveCustomerAccessible, accessibleCustomers, router]);

    const selectedOption = customerOptions.find(option => option.value === activeCustomerId);

    const handleToggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        if (typeof window !== 'undefined') {
            localStorage.setItem('theme', newTheme);
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
        }
    };

    // On mount, sync theme from localStorage and set <html> class
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme') || 'light';
            setTheme(savedTheme);
            document.documentElement.classList.toggle('dark', savedTheme === 'dark');
        }
    }, []);

    // Update <html> class when theme changes
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            document.documentElement.classList.toggle('dark', theme === 'dark');
        }
    }, [theme]);

    const handleCustomerChange = (selectedOption) => {
        if (selectedOption) {
            router.push(`/dashboard/${selectedOption.value}/performance-dashboard`);
        }
    };

    return (
        <>
            <div className="sticky top-0 bg-white flex items-center justify-between px-20 py-5 border-b border-gray-200 transition-colors duration-200">
                <div className="flex items-center space-x-10">
                    <div className="relative hidden">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="pl-10 pr-4 py-[5px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        />
                    </div>
                    <div className="relative">
                        {showLogo && (
                            <Link href="/dashboard">
                                <Image
                                    src="/images/icons/apexlogo-new1.png"
                                    alt="SearchMind Apex Logo"
                                    width={50}
                                    height={50}
                                    className="object-contain"
                                />
                            </Link>
                        )}
                    </div>
                    <div className="relative">
                        <Link href="/home" className="flex items-center space-x-2">
                            <FiHome className="text-gray-400 h-4 w-4" />
                            <span className="text-gray-900">Home</span>
                        </Link>
                    </div>
                    <div className="flex items-center space-x-2">
                        <FiUsers className="text-gray-400 h-4 w-4" />
                        <div className="w-64">
                            <Select
                                value={selectedOption}
                                onChange={handleCustomerChange}
                                options={customerOptions}
                                placeholder="Select Customer"
                                isSearchable={true}
                                isClearable={false}
                                className="react-select-container text-sm"
                                classNamePrefix="react-select"
                                styles={{
                                    control: (provided, state) => ({
                                        ...provided,
                                        border: '1px solid #d1d5db',
                                        borderRadius: '0.375rem',
                                        backgroundColor: 'white',
                                        minHeight: '36px',
                                        boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
                                        '&:hover': {
                                            borderColor: '#9ca3af'
                                        }
                                    }),
                                    menu: (provided) => ({
                                        ...provided,
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '0.5rem',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                        backgroundColor: 'white',
                                        zIndex: 50
                                    }),
                                    option: (provided, state) => ({
                                        ...provided,
                                        backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#f3f4f6' : 'white',
                                        color: state.isSelected ? 'white' : '#374151',
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        '&:active': {
                                            backgroundColor: state.isSelected ? '#2563eb' : '#e5e7eb'
                                        }
                                    }),
                                    singleValue: (provided) => ({
                                        ...provided,
                                        color: '#374151'
                                    }),
                                    placeholder: (provided) => ({
                                        ...provided,
                                        color: '#9ca3af'
                                    }),
                                    input: (provided) => ({
                                        ...provided,
                                        color: '#374151'
                                    })
                                }}
                            />
                        </div>
                    </div>
                    {showLinks && (
                        <div id="teamMembers">
                            <TeamMembers customerId={activeCustomerId} />
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-4">
                    <div>
                        {!user?.isExternal && (
                            <span
                                onClick={() => setShowShareModal(true)}
                            >
                                <FormButton buttonSize="small" type="button" borderType="outline">
                                    Share property
                                </FormButton>
                            </span>
                        )}
                    </div>
                    <button onClick={handleToggleTheme} className="p-2 rounded-full border border-gray-200 bg-white text-gray-700 transition-colors duration-200">
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
                            <span className="text-gray-900">{user?.name || "User"}</span>
                            <FiChevronDown className="ml-2 text-gray-700" />
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 mt-[22px] w-75 bg-white shadow-xs rounded-[1rem] px-4 overflow-hidden z-50 py-4 border border-gray-200 transition-colors duration-200">
                                <div className="mb-4">
                                    <div className="flex items-center justify-between">
                                        <p className="font-semibold text-gray-900">{user?.name}</p>
                                        {user?.isAdmin && (
                                            <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-1">
                                                Admin
                                            </span>
                                        )}

                                        {user?.isExternal && (
                                            <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mt-1 ml-1">
                                                External
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-gray-400 text-xs">{user?.email}</p>
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
            {/* SharePropertyModal (only for non-external users) */}
            {showShareModal && !user?.isExternal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
                    <div className="z-50">
                        <SharePropertyModal
                            customer={accessibleCustomers.find(c => c._id === activeCustomerId)}
                            users={allUsers}
                            onShare={handleShareProperty}
                            onCancel={() => setShowShareModal(false)}
                            loading={shareLoading}
                        />
                        {shareError && <div className="text-red-500 text-sm mt-2">{shareError}</div>}
                    </div>
                </div>
            )}
        </>
    );
};

export default Topbar;