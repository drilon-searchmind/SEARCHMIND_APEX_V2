import React from "react";
import { Input } from "@/components/ui/input"

export default function SearchInput({ onSearch, placeholder }) {
    return (
        <Input type="text" placeholder={placeholder} className="mt-2 shadow-none h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm  placeholder:text-gray-400 focus:outline-hidden focus:ring-3 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 " onChange={(e) => onSearch(e.target.value)} />
    );
}