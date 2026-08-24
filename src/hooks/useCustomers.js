import { useState, useEffect, useCallback } from 'react';
import { useCustomersOverride } from '@/contexts/CustomersOverrideContext';

/** @type {any[] | null} */
let sharedCustomersCache = null;
/** @type {Promise<any[]> | null} */
let sharedCustomersInflight = null;

async function fetchCustomersShared() {
    if (sharedCustomersCache) {
        return sharedCustomersCache;
    }
    if (sharedCustomersInflight) {
        return sharedCustomersInflight;
    }

    sharedCustomersInflight = fetch('/api/customers')
        .then(async (response) => {
            if (!response.ok) {
                throw new Error('Failed to fetch customers');
            }
            return response.json();
        })
        .then((data) => {
            sharedCustomersCache = data;
            return data;
        })
        .finally(() => {
            sharedCustomersInflight = null;
        });

    return sharedCustomersInflight;
}

function invalidateSharedCustomersCache() {
    sharedCustomersCache = null;
    sharedCustomersInflight = null;
}

export function useCustomers(refreshKey = 0, options = {}) {
    const enabled = options.enabled !== false;
    const override = useCustomersOverride();
    const [customers, setCustomers] = useState(() =>
        enabled && sharedCustomersCache ? sharedCustomersCache : []
    );
    const [loading, setLoading] = useState(() => enabled && !sharedCustomersCache);
    const [error, setError] = useState(null);

    // Fetch all customers
    const fetchCustomers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchCustomersShared();
            setCustomers(data);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching customers:', err);
        } finally {
            setLoading(false);
        }
    }, []);

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
            invalidateSharedCustomersCache();
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
            invalidateSharedCustomersCache();
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
            invalidateSharedCustomersCache();
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

    useEffect(() => {
        if (override || !enabled) {
            if (!enabled) setLoading(false);
            return undefined;
        }
        fetchCustomers();
    }, [refreshKey, fetchCustomers, override, enabled]);

    if (override) {
        return override;
    }

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
