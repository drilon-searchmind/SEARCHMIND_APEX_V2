"use client";

import React, { useState, useEffect } from 'react';
import FormButton from '@/components/form/FormButton';
import { FiPlus, FiTrash2, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { showToast } from '@/components/ui/ToastProvider';

export default function SEOKeywordSettings({ customerId }) {
    // Brand Keywords State
    const [brandKeywords, setBrandKeywords] = useState('');
    const [brandKeywordsSaved, setBrandKeywordsSaved] = useState('');
    const [brandLoading, setBrandLoading] = useState(false);

    // Exact Keyword Groups State
    const [exactGroups, setExactGroups] = useState([]);
    const [exactGroupName, setExactGroupName] = useState('');
    const [exactGroupKeywords, setExactGroupKeywords] = useState('');
    const [exactLoading, setExactLoading] = useState(false);
    const [editingExactGroup, setEditingExactGroup] = useState(null);

    // Partial Keyword Groups State
    const [partialGroups, setPartialGroups] = useState([]);
    const [partialGroupName, setPartialGroupName] = useState('');
    const [partialGroupKeywords, setPartialGroupKeywords] = useState('');
    const [partialLoading, setPartialLoading] = useState(false);
    const [editingPartialGroup, setEditingPartialGroup] = useState(null);

    // Fetch all keyword data on mount
    useEffect(() => {
        fetchBrandKeywords();
        fetchExactGroups();
        fetchPartialGroups();
    }, [customerId]);

    // Brand Keywords Functions
    const fetchBrandKeywords = async () => {
        try {
            const res = await fetch(`/api/seo-keywords/brand/${customerId}`);
            const data = await res.json();
            if (data.success && data.data.keywords) {
                const keywords = data.data.keywords.join(', ');
                setBrandKeywords(keywords);
                setBrandKeywordsSaved(keywords);
            }
        } catch (error) {
            console.error('Error fetching brand keywords:', error);
        }
    };

    const saveBrandKeywords = async () => {
        setBrandLoading(true);
        try {
            const keywordsArray = brandKeywords
                .split(',')
                .map(k => k.trim())
                .filter(k => k);

            const res = await fetch(`/api/seo-keywords/brand/${customerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords: keywordsArray })
            });

            const data = await res.json();
            if (data.success) {
                setBrandKeywordsSaved(brandKeywords);
                showToast({ message: 'Brand keywords saved successfully!', type: 'success', position: 'top-center' });

            } else {
                showToast({ message: 'Error saving brand keywords', type: 'error', position: 'top-center' });
            }
        } catch (error) {
            console.error('Error saving brand keywords:', error);
            showToast({ message: 'Error saving brand keywords', type: 'error', position: 'top-center' });

        } finally {
            setBrandLoading(false);
        }
    };

    const deleteBrandKeywords = async () => {
        if (!confirm('Are you sure you want to delete all brand keywords?')) return;

        setBrandLoading(true);
        try {
            const res = await fetch(`/api/seo-keywords/brand/${customerId}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (data.success) {
                setBrandKeywords('');
                setBrandKeywordsSaved('');
                alert('Brand keywords deleted successfully!');
                showToast({ message: 'Brand keywords deleted successfully!', type: 'success', position: 'top-center' });
            }
        } catch (error) {
            console.error('Error deleting brand keywords:', error);
            showToast({ message: 'Error deleting brand keywords', type: 'error', position: 'top-center' });

        } finally {
            setBrandLoading(false);
        }
    };

    // Exact Keyword Groups Functions
    const fetchExactGroups = async () => {
        try {
            const res = await fetch(`/api/seo-keywords/exact/${customerId}`);
            const data = await res.json();
            if (data.success) {
                setExactGroups(data.data);
            }
        } catch (error) {
            console.error('Error fetching exact groups:', error);
        }
    };

    const createExactGroup = async () => {
        if (!exactGroupName.trim()) {
            alert('Please enter a group name');
            return;
        }

        setExactLoading(true);
        try {
            const keywordsArray = exactGroupKeywords
                .split(',')
                .map(k => k.trim())
                .filter(k => k);

            const res = await fetch(`/api/seo-keywords/exact/${customerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: exactGroupName, keywords: keywordsArray })
            });

            const data = await res.json();
            if (data.success) {
                setExactGroups([data.data, ...exactGroups]);
                setExactGroupName('');
                setExactGroupKeywords('');
                showToast({ message: 'Exact keyword group created successfully!', type: 'success', position: 'top-center' });
            }
        } catch (error) {
            console.error('Error creating exact group:', error);
            showToast({ message: 'Error creating exact group', type: 'error', position: 'top-center' });

        } finally {
            setExactLoading(false);
        }
    };

    const updateExactGroup = async (groupId, name, keywords) => {
        setExactLoading(true);
        try {
            const keywordsArray = keywords
                .split(',')
                .map(k => k.trim())
                .filter(k => k);

            const res = await fetch(`/api/seo-keywords/exact/${customerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId, name, keywords: keywordsArray })
            });

            const data = await res.json();
            if (data.success) {
                setExactGroups(exactGroups.map(g => g._id === groupId ? data.data : g));
                setEditingExactGroup(null);
                alert('Exact keyword group updated successfully!');
            }
        } catch (error) {
            console.error('Error updating exact group:', error);
            alert('Error updating exact group');
        } finally {
            setExactLoading(false);
        }
    };

    const deleteExactGroup = async (groupId) => {
        if (!confirm('Are you sure you want to delete this group?')) return;

        setExactLoading(true);
        try {
            const res = await fetch(`/api/seo-keywords/exact/${customerId}?groupId=${groupId}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (data.success) {
                setExactGroups(exactGroups.filter(g => g._id !== groupId));
                alert('Exact keyword group deleted successfully!');
            }
        } catch (error) {
            console.error('Error deleting exact group:', error);
            alert('Error deleting exact group');
        } finally {
            setExactLoading(false);
        }
    };

    // Partial Keyword Groups Functions
    const fetchPartialGroups = async () => {
        try {
            const res = await fetch(`/api/seo-keywords/partial/${customerId}`);
            const data = await res.json();
            if (data.success) {
                setPartialGroups(data.data);
            }
        } catch (error) {
            console.error('Error fetching partial groups:', error);
        }
    };

    const createPartialGroup = async () => {
        if (!partialGroupName.trim()) {
            alert('Please enter a group name');
            return;
        }

        setPartialLoading(true);
        try {
            const keywordsArray = partialGroupKeywords
                .split(',')
                .map(k => k.trim())
                .filter(k => k);

            const res = await fetch(`/api/seo-keywords/partial/${customerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: partialGroupName, keywords: keywordsArray })
            });

            const data = await res.json();
            if (data.success) {
                setPartialGroups([data.data, ...partialGroups]);
                setPartialGroupName('');
                setPartialGroupKeywords('');
                showToast({ message: 'Partial keyword group created successfully!', type: 'success', position: 'top-center' });
            }
        } catch (error) {
            console.error('Error creating partial group:', error);
            showToast({ message: 'Error creating partial group', type: 'error', position: 'top-center' });
        } finally {
            setPartialLoading(false);
        }
    };

    const updatePartialGroup = async (groupId, name, keywords) => {
        setPartialLoading(true);
        try {
            const keywordsArray = keywords
                .split(',')
                .map(k => k.trim())
                .filter(k => k);

            const res = await fetch(`/api/seo-keywords/partial/${customerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId, name, keywords: keywordsArray })
            });

            const data = await res.json();
            if (data.success) {
                setPartialGroups(partialGroups.map(g => g._id === groupId ? data.data : g));
                setEditingPartialGroup(null);
                alert('Partial keyword group updated successfully!');
            }
        } catch (error) {
            console.error('Error updating partial group:', error);
            alert('Error updating partial group');
        } finally {
            setPartialLoading(false);
        }
    };

    const deletePartialGroup = async (groupId) => {
        if (!confirm('Are you sure you want to delete this group?')) return;

        setPartialLoading(true);
        try {
            const res = await fetch(`/api/seo-keywords/partial/${customerId}?groupId=${groupId}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (data.success) {
                setPartialGroups(partialGroups.filter(g => g._id !== groupId));
                alert('Partial keyword group deleted successfully!');
            }
        } catch (error) {
            console.error('Error deleting partial group:', error);
            alert('Error deleting partial group');
        } finally {
            setPartialLoading(false);
        }
    };

    return (
        <div className="mt-12 space-y-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">SEO Keyword Settings</h2>

            {/* Brand Keywords Section */}
            <div className="border border-gray-200 rounded-xl bg-white p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">Brand Keywords</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Define your brand keywords to enable "With Brand" and "Without Brand" filtering.
                            Keywords matching these terms will be considered brand-related searches.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <textarea
                        value={brandKeywords}
                        onChange={(e) => setBrandKeywords(e.target.value)}
                        placeholder="Enter brand keywords separated by commas (e.g., nike, nike shoes, swoosh)"
                        className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)] min-h-[100px] resize-y"
                        disabled={brandLoading}
                    />

                    <div className="flex gap-2">
                        <span onClick={saveBrandKeywords}>
                            <FormButton
                                buttonSize="small"
                                disabled={brandLoading || brandKeywords === brandKeywordsSaved}
                            >
                                {brandLoading ? 'Saving...' : 'Save Brand Keywords'}
                            </FormButton>
                        </span>
                        {brandKeywordsSaved && (
                            <span onClick={deleteBrandKeywords}>
                                <FormButton
                                    buttonSize="small"
                                    borderType="outline"
                                    disabled={brandLoading}
                                >
                                    <FiTrash2 className="inline mr-1" />
                                    Delete All
                                </FormButton>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Exact Keyword Groups Section */}
            <div className="border border-gray-200 rounded-xl bg-white p-6">
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Exact Keyword Groups</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Create groups of exact keywords to filter for. When selected, shows all keywords that match exactly any of the keywords in the group.
                    </p>
                </div>

                {/* Create New Group */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                    <input
                        type="text"
                        value={exactGroupName}
                        onChange={(e) => setExactGroupName(e.target.value)}
                        placeholder="Group name (e.g., Product Names)"
                        className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)]"
                        disabled={exactLoading}
                    />
                    <textarea
                        value={exactGroupKeywords}
                        onChange={(e) => setExactGroupKeywords(e.target.value)}
                        placeholder="Enter exact keywords separated by commas (e.g., air max, air force 1, cortez)"
                        className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)] min-h-[80px] resize-y"
                        disabled={exactLoading}
                    />
                    <span onClick={createExactGroup}>
                        <FormButton buttonSize="small" disabled={exactLoading}>
                            <FiPlus className="inline mr-1" />
                            {exactLoading ? 'Creating...' : 'Create Exact Group'}
                        </FormButton>
                    </span>
                </div>

                {/* List Existing Groups */}
                <div className="space-y-3">
                    {exactGroups.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No exact keyword groups yet</p>
                    ) : (
                        exactGroups.map((group) => (
                            <div key={group._id} className="border border-gray-200 rounded-lg p-4">
                                {editingExactGroup === group._id ? (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            defaultValue={group.name}
                                            id={`exact-name-${group._id}`}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)]"
                                        />
                                        <textarea
                                            defaultValue={group.keywords.join(', ')}
                                            id={`exact-keywords-${group._id}`}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)] min-h-[60px]"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    const name = document.getElementById(`exact-name-${group._id}`).value;
                                                    const keywords = document.getElementById(`exact-keywords-${group._id}`).value;
                                                    updateExactGroup(group._id, name, keywords);
                                                }}
                                                className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors"
                                            >
                                                <FiCheck className="inline mr-1" />
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingExactGroup(null)}
                                                className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-400 transition-colors"
                                            >
                                                <FiX className="inline mr-1" />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-start justify-between mb-2">
                                            <h4 className="font-semibold text-gray-800">{group.name}</h4>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingExactGroup(group._id)}
                                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                                    disabled={exactLoading}
                                                >
                                                    <FiEdit2 />
                                                </button>
                                                <button
                                                    onClick={() => deleteExactGroup(group._id)}
                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                    disabled={exactLoading}
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Keywords:</span> {group.keywords.join(', ')}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Created: {new Date(group.createdAt).toLocaleDateString()}
                                        </p>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Partial Keyword Groups Section */}
            <div className="border border-gray-200 rounded-xl bg-white p-6">
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Keyword Groups (Partial Match)</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Create and manage keyword groups to filter your SEO performance data using partial matching.
                    </p>
                </div>

                {/* Create New Group */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                    <input
                        type="text"
                        value={partialGroupName}
                        onChange={(e) => setPartialGroupName(e.target.value)}
                        placeholder="Group name (e.g., Running Shoes)"
                        className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)]"
                        disabled={partialLoading}
                    />
                    <textarea
                        value={partialGroupKeywords}
                        onChange={(e) => setPartialGroupKeywords(e.target.value)}
                        placeholder="Enter partial keywords separated by commas (e.g., running, jogging, marathon)"
                        className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)] min-h-[80px] resize-y"
                        disabled={partialLoading}
                    />
                    <span onClick={createPartialGroup}>
                        <FormButton buttonSize="small" disabled={partialLoading}>
                            <FiPlus className="inline mr-1" />
                            {partialLoading ? 'Creating...' : 'Create Partial Group'}
                        </FormButton>
                    </span>
                </div>

                {/* List Existing Groups */}
                <div className="space-y-3">
                    {partialGroups.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No partial keyword groups yet</p>
                    ) : (
                        partialGroups.map((group) => (
                            <div key={group._id} className="border border-gray-200 rounded-lg p-4">
                                {editingPartialGroup === group._id ? (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            defaultValue={group.name}
                                            id={`partial-name-${group._id}`}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)]"
                                        />
                                        <textarea
                                            defaultValue={group.keywords.join(', ')}
                                            id={`partial-keywords-${group._id}`}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)] min-h-[60px]"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    const name = document.getElementById(`partial-name-${group._id}`).value;
                                                    const keywords = document.getElementById(`partial-keywords-${group._id}`).value;
                                                    updatePartialGroup(group._id, name, keywords);
                                                }}
                                                className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors"
                                            >
                                                <FiCheck className="inline mr-1" />
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingPartialGroup(null)}
                                                className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-400 transition-colors"
                                            >
                                                <FiX className="inline mr-1" />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-start justify-between mb-2">
                                            <h4 className="font-semibold text-gray-800">{group.name}</h4>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingPartialGroup(group._id)}
                                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                                    disabled={partialLoading}
                                                >
                                                    <FiEdit2 />
                                                </button>
                                                <button
                                                    onClick={() => deletePartialGroup(group._id)}
                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                    disabled={partialLoading}
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Keywords:</span> {group.keywords.join(', ')}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Created: {new Date(group.createdAt).toLocaleDateString()}
                                        </p>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}