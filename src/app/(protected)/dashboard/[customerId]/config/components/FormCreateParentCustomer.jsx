
import React, { useState, useRef, useEffect } from "react";
import FormLabel from '@/components/form/FormLabel';
import FormInputText from '@/components/form/FormInputText';
import FormButton from '@/components/form/FormButton';

export default function FormCreateParentCustomer({ onCreate, onCancel, loading }) {
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!name.trim()) {
            setError("Name is required");
            return;
        }
        const result = await onCreate({ name });
        if (result === false) {
            setError("Failed to create parent customer");
        }
    };

    return (
        <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-xl">
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">Create Parent Customer</h5>
                <div>
                    <FormLabel htmlFor="parentCustomerName" required>Name</FormLabel>
                    <FormInputText
                        id="parentCustomerName"
                        name="parentCustomerName"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        ref={inputRef}
                        disabled={loading}
                    />
                </div>
                {error && <div className="text-red-500 text-sm">{error}</div>}
                <div className="flex gap-2 justify-end mt-2">
                    <div
                        className="flex items-center justify-center text-center shadow-none border border-gray-200 text-gray-500 bg-white hover:bg-white hover:text-[var(--color-primary-searchmind)] rounded-lg cursor-pointer text-xs px-4 py-2"
                        onClick={onCancel}
                    >
                        Cancel
                    </div>
                    <FormButton buttonSize="small" type="submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create'}
                    </FormButton>
                </div>
            </form>
        </div>
    );
}
