import React, { useState, useEffect } from "react";
import FormButton from '@/components/form/FormButton';
import FormLabel from '@/components/form/FormLabel';
import Spinner from '@/components/ui/Spinner';


export default function SharePropertyModal({ customer, users, onShare, onCancel, loading }) {
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [error, setError] = useState("");

    // Only show external users
    const externalUsers = users.filter(u => u.isExternal);

    // Get already shared user ids for this customer
    const alreadySharedUserIds = externalUsers.filter(u => {
        const shared = (u.sharedCustomers || []).map(id => typeof id === 'object' && id.$oid ? id.$oid : String(id));
        return shared.includes(String(customer?._id));
    }).map(u => u._id);

    // On mount, preselect already shared users
    React.useEffect(() => {
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

    return (
        <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-xl">
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">Share Property</h5>
                <div>
                    <FormLabel>External Users</FormLabel>
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                        {externalUsers.length === 0 && <div className="text-gray-400">No external users found.</div>}
                        {externalUsers.map(user => {
                            const isAlreadyShared = alreadySharedUserIds.includes(user._id);
                            return (
                                <label key={user._id} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedUserIds.includes(user._id)}
                                        onChange={() => handleToggleUser(user._id)}
                                        disabled={loading}
                                    />
                                    <span>
                                        {user.name} ({user.email})
                                        {isAlreadyShared && <span className="ml-1 text-xs text-green-500">(already shared)</span>}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
                {error && <div className="text-red-500 text-sm">{error}</div>}
                <div className="flex gap-2 justify-end mt-2">
                    <div
                        className="flex items-center justify-center text-center shadow-none border border-gray-200 text-gray-500 bg-white hover:bg-white hover:text-[var(--color-primary-searchmind)] rounded-lg cursor-pointer text-xs px-4 py-2"
                        onClick={onCancel}
                    >
                        Cancel
                    </div>
                    <FormButton buttonSize="small" type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save'}
                    </FormButton>
                </div>
            </form>
        </div>
    );
}
