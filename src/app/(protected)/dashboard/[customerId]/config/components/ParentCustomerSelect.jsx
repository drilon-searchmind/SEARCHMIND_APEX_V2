import FormButton from "@/components/form/FormButton";
import FormLabel from "@/components/form/FormLabel";
import React from "react";

export default function ParentCustomerSelect({ parentCustomers, value, onChange, onCreateClick, disabled }) {
    return (
        <div className="flex flex-col gap-2">
            <FormLabel htmlFor="parentCustomer">Parent Customer</FormLabel>
            <div className="flex flex-col gap-2">
                <select
                    id="parentCustomer"
                    name="parentCustomer"
                    value={value || ""}
                    onChange={onChange}
                    disabled={disabled || parentCustomers.length === 0}
                >
                    <option value="">None</option>
                    {parentCustomers.map((pc) => (
                        <option key={pc._id} value={pc._id}>{pc.name}</option>
                    ))}
                </select>
                <button type="button" className="apex-config-link-btn w-fit" onClick={onCreateClick}>
                    + New parent customer
                </button>
            </div>
            {parentCustomers.length === 0 ? (
                <p className="apex-config-field-hint">No parent customers found. Create one to assign.</p>
            ) : null}
        </div>
    );
}
