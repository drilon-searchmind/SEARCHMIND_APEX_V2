"use client";

import React, { useState } from "react";
import { FiX, FiCopy, FiCheck } from "react-icons/fi";

export default function PasswordDisplayModal({ password, onClose }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(password);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy password:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
            <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close modal"
                >
                    <FiX className="text-2xl" />
                </button>

                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Created Successfully!</h2>
                    <p className="text-gray-600">
                        Your account has been created. Please save this password for future logins with email/password.
                    </p>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Your Password:
                    </label>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 font-mono text-lg text-gray-900 break-all">
                            {password}
                        </div>
                        <button
                            onClick={handleCopy}
                            className="px-4 py-3 bg-[var(--color-primary-searchmind)] text-white rounded-lg hover:bg-[var(--color-primary-searchmind-lighter)] transition-colors flex items-center gap-2"
                            title="Copy password"
                        >
                            {copied ? (
                                <>
                                    <FiCheck size={18} />
                                    <span className="text-sm">Copied!</span>
                                </>
                            ) : (
                                <>
                                    <FiCopy size={18} />
                                    <span className="text-sm">Copy</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-yellow-800">
                        <strong>Important:</strong> Save this password securely. You can use it to log in with your email and password in the future, or continue using Google SSO.
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="w-full px-6 py-3 bg-[var(--color-primary-searchmind)] text-white rounded-lg font-semibold hover:bg-[var(--color-primary-searchmind-lighter)] transition-colors"
                >
                    Continue to Dashboard
                </button>
            </div>
        </div>
    );
}
