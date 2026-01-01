"use client"

import CustomerTable from '@/components/table/CustomerTable'
import CustomerCreateForm from '@/components/form/CustomerCreateForm'
import Image from 'next/image'
import React, { useState } from 'react'


const HomePage = () => {
    const [showCreate, setShowCreate] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleCreated = () => {
        setShowCreate(false);
        setRefreshKey((k) => k + 1); // trigger CustomerTable refresh
    };

    return (
        <div id='HomePage' className="flex h-screen lg:flex-row flex-col">
            <div className="relative flex-1 flex items-center justify-center bg-[var(--color-primary-searchmind-lighter)] text-white">
                {/* Background image overlay */}
                <div className="absolute inset-0">
                    <Image
                        src="/images/overlays/26305.jpg"
                        alt="Background overlay"
                        layout="fill"
                        objectFit="cover"
                        className="opacity-40"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[var(--color-primary-searchmind-lighter)]"></div>
                </div>
                <CustomerTable key={refreshKey} showCustomerTable={true} />
            </div>
            <div className="flex-1 flex items-center justify-center bg-white"></div>
        </div>
    )
}

export default HomePage