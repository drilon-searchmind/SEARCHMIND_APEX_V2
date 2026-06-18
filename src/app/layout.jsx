import { Geist, Geist_Mono } from "next/font/google";
import AuthProvider from "@/contexts/AuthProvider";
import { UserProvider } from "@/contexts/UserContext";
import AuthGuard from "@/contexts/AuthGuard";
import { GoogleTagManager } from '@next/third-parties/google';

import "./globals.css";

/** Re-enable with Topbar theme switcher (`THEME_TOGGLE_ENABLED`). */
const THEME_TOGGLE_ENABLED = false;

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata = {
	title: "Searchmind Apex",
	description: "Searchmind Apex Dashboard Webapp",
	icons: {
		icon: "/images/icons/apex-icon-svg.svg",
		shortcut: "/images/icons/apex-icon-svg.svg",
		apple: "/images/icons/apex-icon-svg.svg",
	},
};

export default function RootLayout({ children }) {
	const gtmId = "GTM-MWM37VKJ";

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script
					dangerouslySetInnerHTML={{
						__html: THEME_TOGGLE_ENABLED
							? `(function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`
							: `(function(){try{localStorage.setItem('theme','light');document.documentElement.classList.remove('dark');}catch(e){}})();`,
					}}
				/>
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<AuthProvider>
					<UserProvider>
						<AuthGuard>
							{children}
							
						</AuthGuard>
					</UserProvider>
				</AuthProvider>

				<GoogleTagManager gtmId={gtmId} />
			</body>
		</html>
	);
}
