import connectToDatabase from '../lib/mongodb.js';
import Customer from '../src/models/Customer.js';

async function createCustomer() {
    await connectToDatabase();

    const newCustomer = new Customer({
        customerName: 'Test Customer Inc.',
        parentCustomer: null, // Can be set to another customer ID if this is a sub-customer
        isArchived: false,
        customerType: 'Shopify',
        CustomerSettings: {
            metricPreference: 'ROAS/POAS',
            customerStoreValutaCode: 'DKK',
            customerClickupID: '123456789',
            customerMetaID: 'DK',
            customerMetaIDExclude: '',
            changeCurrency: true,
            changeCurrencyShopifyBillingCountryName: 'Denmark',
            customerRevenueType: 'total_sales',
            shopifyUrl: 'https://test-customer.myshopify.com',
            shopifyApiPassword: 'your-shopify-api-password',
            facebookAdAccountId: '123456789012345',
            googleAdsCustomerId: '123-456-7890',
        }
    });

    try {
        const savedCustomer = await newCustomer.save();
    } catch (error) {
        console.error('Error creating customer:', error);
    }
}

createCustomer();