"use client";

import Image from "next/image";
import Spinner from "@/components/ui/Spinner";

export default function Home() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50">
			<div className="w-full max-w-4xl px-6 py-12">
				{/* Header Section */}
				<div className="bg-white border border-gray-200 rounded-xl px-8 py-12 mb-8 text-center">
					<div className="flex justify-center mb-6">
						<Image
							src="/images/icons/apex-icon-svg.svg"
							alt="Searchmind Apex Logo"
							width={120}
							height={120}
							priority
							className="object-contain"
						/>
					</div>
					<h1 className="text-4xl md:text-5xl font-bold text-[var(--color-primary-searchmind)] mb-4">
						Searchmind Apex
					</h1>
					<p className="text-lg text-gray-600 mb-2">
						Marketing Performance Dashboard
					</p>
					<p className="text-sm text-gray-400">
						Loading your dashboard...
					</p>
				</div>

				{/* Loading State */}
				<div className="bg-white border border-gray-200 rounded-xl px-8 py-12 flex flex-col items-center justify-center">
					<Spinner size={48} color="#406969" />
					<p className="mt-6 text-gray-600 text-sm">
						Verifying authentication and loading data
					</p>
				</div>
			</div>
		</div>
	);
}
