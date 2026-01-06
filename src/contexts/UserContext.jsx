"use client";
import { useSession } from "next-auth/react";
import React, { createContext, useContext, useEffect, useState } from "react";

const UserContext = createContext(null);
const UserUpdateContext = createContext(() => { });

export function UserProvider({ children }) {
	const { data: session } = useSession();
	const [user, setUser] = useState(session?.user || null);

	// Keep local user state in sync with NextAuth session changes
	useEffect(() => {
		setUser(session?.user || null);
	}, [session]);

	return (
		<UserContext.Provider value={user}>
			<UserUpdateContext.Provider value={setUser}>
				{children}
			</UserUpdateContext.Provider>
		</UserContext.Provider>
	);
}

// Backward-compatible: returns user object directly
export function useUser() {
	return useContext(UserContext);
}

// New: returns the setter to override user locally (e.g., after profile update)
export function useSetUser() {
	return useContext(UserUpdateContext);
}
