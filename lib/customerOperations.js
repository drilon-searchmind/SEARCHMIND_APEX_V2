import connectToDatabase from './mongodb.js';
import Customer from '../src/models/Customer.js';

/**
 * Get all customers from database
 * @param {Object} options - Query options
 * @param {boolean} options.includeArchived - Include archived customers (default: false)
 * @returns {Promise<Array>} Array of customers
 */
export async function getAllCustomers(options = {}) {
    await connectToDatabase();

    const query = {};
    if (!options.includeArchived) {
        query.isArchived = false;
    }

    try {
        const customers = await Customer.find(query).sort({ createdAt: -1 });
        return customers;
    } catch (error) {
        throw new Error(`Failed to fetch customers: ${error.message}`);
    }
}

/**
 * Get a single customer by ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Customer object
 */
export async function getCustomerById(customerId) {
    await connectToDatabase();

    try {
        const customer = await Customer.findById(customerId);
        if (!customer) {
            throw new Error('Customer not found');
        }
        return customer;
    } catch (error) {
        throw new Error(`Failed to fetch customer: ${error.message}`);
    }
}

/**
 * Create a new customer
 * @param {Object} customerData - Customer data
 * @returns {Promise<Object>} Created customer
 */
export async function createCustomer(customerData) {
    await connectToDatabase();

    try {
        const customer = new Customer(customerData);
        const savedCustomer = await customer.save();
        return savedCustomer;
    } catch (error) {
        throw new Error(`Failed to create customer: ${error.message}`);
    }
}

/**
 * Update an existing customer
 * @param {string} customerId - Customer ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated customer
 */
export async function updateCustomer(customerId, updateData) {
    await connectToDatabase();

    try {
        const customer = await Customer.findByIdAndUpdate(
            customerId,
            { ...updateData, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!customer) {
            throw new Error('Customer not found');
        }

        return customer;
    } catch (error) {
        throw new Error(`Failed to update customer: ${error.message}`);
    }
}

/**
 * Delete (archive) a customer
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Archived customer
 */
export async function deleteCustomer(customerId) {
    await connectToDatabase();

    try {
        const customer = await Customer.findByIdAndUpdate(
            customerId,
            { isArchived: true, updatedAt: new Date() },
            { new: true }
        );

        if (!customer) {
            throw new Error('Customer not found');
        }

        return customer;
    } catch (error) {
        throw new Error(`Failed to delete customer: ${error.message}`);
    }
}

/**
 * Permanently delete a customer (hard delete)
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Deleted customer
 */
export async function permanentlyDeleteCustomer(customerId) {
    await connectToDatabase();

    try {
        const customer = await Customer.findByIdAndDelete(customerId);

        if (!customer) {
            throw new Error('Customer not found');
        }

        return customer;
    } catch (error) {
        throw new Error(`Failed to permanently delete customer: ${error.message}`);
    }
}