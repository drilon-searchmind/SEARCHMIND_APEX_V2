"use client"

import CustomerTable from '@/components/table/CustomerTable'
import Image from 'next/image'
import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import PasswordDisplayModal from '@/components/auth/PasswordDisplayModal'

const HomePage = () => {
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState("");
    const { data: session } = useSession();

    // Check if user just logged in with Google SSO and has a temp password
    useEffect(() => {
        // Only show modal if:
        // 1. User is a new Google SSO user
        // 2. Has a temp password
        // 3. Modal hasn't been shown yet
        // 4. We haven't already shown it in this session (check localStorage)
        if (
            session?.user?.isNewGoogleUser && 
            session?.user?.tempPassword && 
            !showPasswordModal
        ) {
            const hasShownModal = localStorage.getItem(`passwordModalShown_${session.user.email}`);
            if (!hasShownModal) {
                setGeneratedPassword(session.user.tempPassword);
                setShowPasswordModal(true);
                // Mark as shown in localStorage so it doesn't show again
                localStorage.setItem(`passwordModalShown_${session.user.email}`, 'true');
            }
        }
    }, [session, showPasswordModal]);

    return (
        <div id="HomePage" className="relative min-h-screen bg-[var(--color-primary-searchmind-lighter)]">
            {/* Background image overlay */}
            <div className="absolute inset-0 pointer-events-none">
                <Image
                    src="/images/overlays/26305.jpg"
                    alt=""
                    fill
                    className="object-cover opacity-40"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[var(--color-primary-searchmind-lighter)]" />
            </div>
            <CustomerTable />

            {/* Password Display Modal */}
            {showPasswordModal && generatedPassword && (
                <PasswordDisplayModal
                    password={generatedPassword}
                    onClose={() => {
                        setShowPasswordModal(false);
                        setGeneratedPassword("");
                    }}
                />
            )}
        </div>
    )
}

export default HomePage