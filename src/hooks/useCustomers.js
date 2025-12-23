import { useState, useEffect } from 'react';

export function useCustomers() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch all customers
    const fetchCustomers = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/customers');

            if (!response.ok) {
                throw new Error('Failed to fetch customers');
            }

            const data = await response.json();
            setCustomers(data);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching customers:', err);
        } finally {
            setLoading(false);
        }
    };

    // Create a new customer
    const createCustomer = async (customerData) => {
        try {
            setError(null);
            const response = await fetch('/api/customers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(customerData),
            });

            if (!response.ok) {
                throw new Error('Failed to create customer');
            }

            const newCustomer = await response.json();
            setCustomers(prev => [newCustomer, ...prev]);
            return newCustomer;
        } catch (err) {
            setError(err.message);
            console.error('Error creating customer:', err);
            throw err;
        }
    };

    // Update an existing customer
    const updateCustomer = async (customerId, updateData) => {
        try {
            setError(null);
            const response = await fetch(`/api/customers/${customerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) {
                throw new Error('Failed to update customer');
            }

            const updatedCustomer = await response.json();
            setCustomers(prev =>
                prev.map(customer =>
                    customer._id === customerId ? updatedCustomer : customer
                )
            );
            return updatedCustomer;
        } catch (err) {
            setError(err.message);
            console.error('Error updating customer:', err);
            throw err;
        }
    };

    // Delete (archive) a customer
    const deleteCustomer = async (customerId) => {
        try {
            setError(null);
            const response = await fetch(`/api/customers/${customerId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete customer');
            }

            const result = await response.json();
            setCustomers(prev =>
                prev.filter(customer => customer._id !== customerId)
            );
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error deleting customer:', err);
            throw err;
        }
    };

    // Load customers on mount
    useEffect(() => {
        fetchCustomers();
    }, []);

    return {
        customers,
        loading,
        error,
        fetchCustomers,
        createCustomer,
        updateCustomer,
        deleteCustomer,
    };
}