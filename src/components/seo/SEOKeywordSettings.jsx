"use client";

import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { showToast } from '@/components/ui/ToastProvider';

export default function SEOKeywordSettings({ customerId, onKeywordsUpdate }) {
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
                if (onKeywordsUpdate) onKeywordsUpdate();
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
                showToast({ message: 'Brand keywords deleted successfully!', type: 'success', position: 'top-center' });
                if (onKeywordsUpdate) onKeywordsUpdate();
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
                if (onKeywordsUpdate) onKeywordsUpdate();
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
                if (onKeywordsUpdate) onKeywordsUpdate();
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
                if (onKeywordsUpdate) onKeywordsUpdate();
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
                if (onKeywordsUpdate) onKeywordsUpdate();
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
                if (onKeywordsUpdate) onKeywordsUpdate();
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
                if (onKeywordsUpdate) onKeywordsUpdate();
            }
        } catch (error) {
            console.error('Error deleting partial group:', error);
            alert('Error deleting partial group');
        } finally {
            setPartialLoading(false);
        }
    };

    return (
        <section className="apex-seo-keywords">
            <div className="apex-seo-keywords__head">
                <h3 className="apex-seo-keywords__title">SEO Keyword Settings</h3>
                <p className="apex-seo-keywords__subtitle">Configure brand and keyword group filters for SEO reporting</p>
            </div>

            <div className="apex-seo-keywords__grid">
                {/* Brand Keywords Section */}
                <div className="apex-seo-keywords__card">
                    <h4 className="apex-seo-keywords__card-title">Brand Keywords</h4>
                    <p className="apex-seo-keywords__card-lede">
                        Define brand keywords to enable branded vs non-branded filtering in organic insights.
                    </p>

                    <div className="space-y-3">
                        <textarea
                            value={brandKeywords}
                            onChange={(e) => setBrandKeywords(e.target.value)}
                            placeholder="Enter brand keywords separated by commas (e.g., nike, nike shoes, swoosh)"
                            className="apex-seo-textarea"
                            disabled={brandLoading}
                        />

                        <div className="apex-seo-keywords__actions">
                            <button
                                type="button"
                                className="apex-perf-btn apex-perf-btn--primary"
                                onClick={saveBrandKeywords}
                                disabled={brandLoading || brandKeywords === brandKeywordsSaved}
                            >
                                {brandLoading ? 'Saving…' : 'Save Brand Keywords'}
                            </button>
                            {brandKeywordsSaved ? (
                                <button
                                    type="button"
                                    className="apex-perf-btn"
                                    onClick={deleteBrandKeywords}
                                    disabled={brandLoading}
                                >
                                    <FiTrash2 aria-hidden />
                                    Delete All
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Exact Keyword Groups Section */}
                <div className="apex-seo-keywords__card">
                    <h4 className="apex-seo-keywords__card-title">Exact Keyword Groups</h4>
                    <p className="apex-seo-keywords__card-lede">
                        Filter for keywords that match exactly any term in the group.
                    </p>

                    <div className="apex-seo-keywords__group mb-4 space-y-3">
                        <input
                            type="text"
                            value={exactGroupName}
                            onChange={(e) => setExactGroupName(e.target.value)}
                            placeholder="Group name (e.g., Product Names)"
                            className="apex-seo-input"
                            disabled={exactLoading}
                        />
                        <textarea
                            value={exactGroupKeywords}
                            onChange={(e) => setExactGroupKeywords(e.target.value)}
                            placeholder="Enter exact keywords separated by commas"
                            className="apex-seo-textarea"
                            disabled={exactLoading}
                        />
                        <button
                            type="button"
                            className="apex-perf-btn apex-perf-btn--primary"
                            onClick={createExactGroup}
                            disabled={exactLoading}
                        >
                            <FiPlus aria-hidden />
                            {exactLoading ? 'Creating…' : 'Create Exact Group'}
                        </button>
                    </div>

                    <div className="space-y-3">
                        {exactGroups.length === 0 ? (
                            <p className="apex-seo-empty">No exact keyword groups yet</p>
                        ) : (
                            exactGroups.map((group) => (
                                <div key={group._id} className="apex-seo-keywords__group">
                                    {editingExactGroup === group._id ? (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                defaultValue={group.name}
                                                id={`exact-name-${group._id}`}
                                                className="apex-seo-input"
                                            />
                                            <textarea
                                                defaultValue={group.keywords.join(', ')}
                                                id={`exact-keywords-${group._id}`}
                                                className="apex-seo-textarea"
                                            />
                                            <div className="apex-seo-keywords__actions">
                                                <button
                                                    type="button"
                                                    className="apex-perf-btn apex-perf-btn--primary"
                                                    onClick={() => {
                                                        const name = document.getElementById(`exact-name-${group._id}`).value;
                                                        const keywords = document.getElementById(`exact-keywords-${group._id}`).value;
                                                        updateExactGroup(group._id, name, keywords);
                                                    }}
                                                >
                                                    <FiCheck aria-hidden />
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    className="apex-perf-btn"
                                                    onClick={() => setEditingExactGroup(null)}
                                                >
                                                    <FiX aria-hidden />
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <h5 className="apex-seo-keywords__group-name">{group.name}</h5>
                                                <div className="flex gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingExactGroup(group._id)}
                                                        className="apex-seo-icon-btn"
                                                        disabled={exactLoading}
                                                        aria-label="Edit group"
                                                    >
                                                        <FiEdit2 />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteExactGroup(group._id)}
                                                        className="apex-seo-icon-btn is-danger"
                                                        disabled={exactLoading}
                                                        aria-label="Delete group"
                                                    >
                                                        <FiTrash2 />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-[var(--color-ink-2)]">
                                                <span className="font-medium">Keywords:</span> {group.keywords.join(', ')}
                                            </p>
                                            <p className="apex-seo-keywords__group-meta">
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
                <div className="apex-seo-keywords__card">
                    <h4 className="apex-seo-keywords__card-title">Keyword Groups (Partial Match)</h4>
                    <p className="apex-seo-keywords__card-lede">
                        Filter SEO performance data using partial keyword matching.
                    </p>

                    <div className="apex-seo-keywords__group mb-4 space-y-3">
                        <input
                            type="text"
                            value={partialGroupName}
                            onChange={(e) => setPartialGroupName(e.target.value)}
                            placeholder="Group name (e.g., Running Shoes)"
                            className="apex-seo-input"
                            disabled={partialLoading}
                        />
                        <textarea
                            value={partialGroupKeywords}
                            onChange={(e) => setPartialGroupKeywords(e.target.value)}
                            placeholder="Enter partial keywords separated by commas"
                            className="apex-seo-textarea"
                            disabled={partialLoading}
                        />
                        <button
                            type="button"
                            className="apex-perf-btn apex-perf-btn--primary"
                            onClick={createPartialGroup}
                            disabled={partialLoading}
                        >
                            <FiPlus aria-hidden />
                            {partialLoading ? 'Creating…' : 'Create Partial Group'}
                        </button>
                    </div>

                    <div className="space-y-3">
                        {partialGroups.length === 0 ? (
                            <p className="apex-seo-empty">No partial keyword groups yet</p>
                        ) : (
                            partialGroups.map((group) => (
                                <div key={group._id} className="apex-seo-keywords__group">
                                    {editingPartialGroup === group._id ? (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                defaultValue={group.name}
                                                id={`partial-name-${group._id}`}
                                                className="apex-seo-input"
                                            />
                                            <textarea
                                                defaultValue={group.keywords.join(', ')}
                                                id={`partial-keywords-${group._id}`}
                                                className="apex-seo-textarea"
                                            />
                                            <div className="apex-seo-keywords__actions">
                                                <button
                                                    type="button"
                                                    className="apex-perf-btn apex-perf-btn--primary"
                                                    onClick={() => {
                                                        const name = document.getElementById(`partial-name-${group._id}`).value;
                                                        const keywords = document.getElementById(`partial-keywords-${group._id}`).value;
                                                        updatePartialGroup(group._id, name, keywords);
                                                    }}
                                                >
                                                    <FiCheck aria-hidden />
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    className="apex-perf-btn"
                                                    onClick={() => setEditingPartialGroup(null)}
                                                >
                                                    <FiX aria-hidden />
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <h5 className="apex-seo-keywords__group-name">{group.name}</h5>
                                                <div className="flex gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingPartialGroup(group._id)}
                                                        className="apex-seo-icon-btn"
                                                        disabled={partialLoading}
                                                        aria-label="Edit group"
                                                    >
                                                        <FiEdit2 />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => deletePartialGroup(group._id)}
                                                        className="apex-seo-icon-btn is-danger"
                                                        disabled={partialLoading}
                                                        aria-label="Delete group"
                                                    >
                                                        <FiTrash2 />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-[var(--color-ink-2)]">
                                                <span className="font-medium">Keywords:</span> {group.keywords.join(', ')}
                                            </p>
                                            <p className="apex-seo-keywords__group-meta">
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
        </section>
    );
}