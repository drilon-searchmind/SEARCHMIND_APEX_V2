import React, { useState, useEffect } from "react";
import FormButton from '@/components/form/FormButton';
import FormLabel from '@/components/form/FormLabel';
import Spinner from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/ToastProvider';
import { FiX } from 'react-icons/fi';


export default function SharePropertyModal({ customer, users = [], onShare, onCancel, loading }) {
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'

    // Create form state
    const [createName, setCreateName] = useState('');
    const [createEmail, setCreateEmail] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');

    // Local external users list so we can append newly created users immediately
    const [externalUsersLocal, setExternalUsersLocal] = useState(() => (users || []).filter(u => u.isExternal));

    // keep local list in sync when prop changes
    useEffect(() => {
        setExternalUsersLocal((users || []).filter(u => u.isExternal));
    }, [users]);

    // Get already shared user ids for this customer from local list
    const alreadySharedUserIds = externalUsersLocal.filter(u => {
        const shared = (u.sharedCustomers || []).map(id => typeof id === 'object' && id.$oid ? id.$oid : String(id));
        return shared.includes(String(customer?._id));
    }).map(u => u._id);

    // On mount / when customer/users change, preselect already shared users
    useEffect(() => {
        setSelectedUserIds(alreadySharedUserIds);
        // eslint-disable-next-line
    }, [customer?._id, users]);

    const handleToggleUser = (userId) => {
        setSelectedUserIds(ids =>
            ids.includes(userId) ? ids.filter(id => id !== userId) : [...ids, userId]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        // Compute add and remove lists
        const toAdd = selectedUserIds.filter(id => !alreadySharedUserIds.includes(id));
        const toRemove = alreadySharedUserIds.filter(id => !selectedUserIds.includes(id));
        if (toAdd.length === 0 && toRemove.length === 0) {
            setError("No changes to save");
            return;
        }
        await onShare(toAdd, toRemove);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreateError('');
        if (!createName.trim() || !createEmail.trim() || !createPassword.trim()) {
            setCreateError('Name, email and password are required');
            return;
        }
        setCreateLoading(true);
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: createName.trim(), email: createEmail.trim().toLowerCase(), password: createPassword.trim() })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data?.error || 'Failed to create user';
                setCreateError(msg);
                showToast({ type: 'error', message: msg });
            } else {
                if (data && data._id) {
                    // append new user to local list so it appears immediately
                    setExternalUsersLocal(prev => [data, ...prev]);
                    // select the new user so it will be shared
                    setSelectedUserIds(prev => Array.from(new Set([data._id, ...prev])));
                    // perform share action
                    await onShare([data._id], []);
                    showToast({ type: 'success', message: 'External user created and shared' });
                    // reset form
                    setCreateName('');
                    setCreateEmail('');
                    setCreatePassword('');
                    // switch back to list tab
                    setActiveTab('list');
                }
            }
        } catch (err) {
            const msg = err?.message || 'Unexpected error';
            setCreateError(msg);
            showToast({ type: 'error', message: msg });
        } finally {
            setCreateLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
                <div>
                    <h5 className="text-lg font-semibold text-gray-900">Share Property</h5>
                    <p className="text-xs text-gray-500">Share this property with external users or create a new external user.</p>
                </div>
                <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1 rounded"><FiX /></button>
            </div>

            <div className="p-4">
                <div className="flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden mb-4">
                    <button
                        type="button"
                        className={`w-full px-4 border-r border-gray-50 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 text-gray-500 ${activeTab === 'list' ? 'bg-[var(--color-primary-searchmind)] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                        onClick={() => setActiveTab('list')}
                    >
                        External users
                    </button>
                    <button
                        type="button"
                        className={`w-full px-4 border-r border-gray-50 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 text-gray-500 ${activeTab === 'create' ? 'bg-[var(--color-primary-searchmind)] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                        onClick={() => setActiveTab('create')}
                    >
                        Create external user
                    </button>
                </div>

                {activeTab === 'list' && (
                    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                        <div>
                            <FormLabel>External Users</FormLabel>
                            <div className="flex flex-col gap-3 max-h-100 overflow-y-auto mt-2">
                                {externalUsersLocal.length === 0 && <div className="text-gray-400">No external users found.</div>}
                                {externalUsersLocal.map(user => {
                                    const isAlreadyShared = alreadySharedUserIds.includes(user._id);
                                    return (
                                        <label key={user._id} className="flex items-center gap-2 cursor-pointer border-b border-gray-100 py-1">
                                            <input
                                                type="checkbox"
                                                checked={selectedUserIds.includes(user._id)}
                                                onChange={() => handleToggleUser(user._id)}
                                                disabled={loading}
                                            />
                                            <span className="text-sm flex flex-col gap-0">
                                                <span className="flex items-center gap-1">
                                                    {user.name} {isAlreadyShared && <span className="ml-0 text-xs text-green-500">(shared)</span>}
                                                </span>
                                                 <span className="text-xs text-gray-400">({user.email})</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        {error && <div className="text-red-500 text-sm">{error}</div>}
                        <div className="flex gap-2 justify-end mt-2">
                            <button type="button" onClick={onCancel} className="px-3 py-1 rounded border text-sm text-gray-600">Cancel</button>
                            <FormButton buttonSize="small" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</FormButton>
                        </div>
                    </form>
                )}

                {activeTab === 'create' && (
                    <form className="flex flex-col gap-3" onSubmit={handleCreateUser}>
                        <div>
                            <FormLabel>Name</FormLabel>
                            <input required value={createName} onChange={(e) => setCreateName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] focus:ring-opacity-20" />
                        </div>
                        <div>
                            <FormLabel>Email</FormLabel>
                            <input required type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] focus:ring-opacity-20" />
                        </div>
                        <div>
                            <FormLabel>Password</FormLabel>
                            <input required type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] focus:ring-opacity-20" />
                        </div>
                        {createError && <div className="text-red-500 text-sm">{createError}</div>}
                        <div className="flex gap-2 justify-end mt-2">
                            <button type="button" onClick={onCancel} className="px-3 py-1 rounded border text-sm text-gray-600">Cancel</button>
                            <FormButton buttonSize="small" type="submit" disabled={createLoading}>{createLoading ? (<><Spinner /> Creating...</>) : 'Create & Share'}</FormButton>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
