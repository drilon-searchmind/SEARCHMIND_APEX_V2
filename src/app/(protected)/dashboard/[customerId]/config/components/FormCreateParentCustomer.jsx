
import React, { useState, useRef, useEffect } from "react";
import FormLabel from '@/components/form/FormLabel';
import FormInputText from '@/components/form/FormInputText';

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
        <form className="apex-config-form" onSubmit={handleSubmit}>
            <h2 className="apex-config-form__title">Create Parent Customer</h2>
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
            {error ? <div className="apex-config-error">{error}</div> : null}
            <div className="apex-config-modal__actions">
                <button type="button" className="apex-config-modal__cancel" onClick={onCancel}>
                    Cancel
                </button>
                <button type="submit" className="apex-perf-btn apex-perf-btn--primary" disabled={loading}>
                    {loading ? 'Creating...' : 'Create'}
                </button>
            </div>
        </form>
    );
}
