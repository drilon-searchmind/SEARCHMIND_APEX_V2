"use client";

import CustomerTable from '@/components/table/CustomerTable'
import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import PasswordDisplayModal from '@/components/auth/PasswordDisplayModal'
import './home.css'

const HomePage = () => {
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState("");
    const { data: session } = useSession();

    useEffect(() => {
        if (
            session?.user?.isNewGoogleUser &&
            session?.user?.tempPassword &&
            !showPasswordModal
        ) {
            const hasShownModal = localStorage.getItem(`passwordModalShown_${session.user.email}`);
            if (!hasShownModal) {
                setGeneratedPassword(session.user.tempPassword);
                setShowPasswordModal(true);
                localStorage.setItem(`passwordModalShown_${session.user.email}`, 'true');
            }
        }
    }, [session, showPasswordModal]);

    return (
        <div id="HomePage" className="cobalt-home" data-theme="cobalt">
            <CustomerTable />

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
