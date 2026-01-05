import FormButton from "@/components/form/FormButton";
import React from "react";

export default function ParentCustomerSelect({ parentCustomers, value, onChange, onCreateClick, disabled }) {
    return (
        <div className="flex flex-col gap-2">
            <label htmlFor="parentCustomer" className="block text-sm font-medium text-gray-700">
                Parent Customer
            </label>
            <div className="flex gap-2 flex-col">
                <select
                    id="parentCustomer"
                    name="parentCustomer"
                    value={value || ""}
                    onChange={onChange}
                    className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                    disabled={disabled || parentCustomers.length === 0}
                >
                    <option value="">None</option>
                    {parentCustomers.map((pc) => (
                        <option key={pc._id} value={pc._id}>{pc.name}</option>
                    ))}
                </select>
                <span onClick={onCreateClick} className="w-24">
                    <FormButton buttonSize="small">
                        + New
                    </FormButton>
                </span>
            </div>
            {parentCustomers.length === 0 && (
                <span className="text-xs text-gray-500 mt-1">No parent customers found. Create one to assign.</span>
            )}
        </div>
    );
}
