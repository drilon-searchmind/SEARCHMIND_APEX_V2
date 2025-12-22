"use client";
import { useSession } from "next-auth/react";
import React, { createContext, useContext } from "react";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { data: session } = useSession();
  const user = session?.user || null;
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
