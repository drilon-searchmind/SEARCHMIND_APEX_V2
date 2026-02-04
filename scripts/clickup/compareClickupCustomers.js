import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import connectToDatabase from '../../lib/mongodb.js';
import Customer from '../../src/models/Customer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function compareClickupCustomers() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await connectToDatabase();
        console.log('Connected to MongoDB');

        // Read CSV file
        const csvPath = path.join(__dirname, 'TEMP_ clickup_customers_ark1.csv');
        console.log('Reading CSV file:', csvPath);
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        
        // Parse CSV
        const lines = csvContent.split('\n').filter(line => line.trim());
        const csvCustomers = [];
        
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Handle CSV parsing (accounting for commas in names)
            const match = line.match(/^([^,]+),(.+)$/);
            if (match) {
                const client_id = match[1].trim();
                const client_name = match[2].trim();
                csvCustomers.push({ client_id, client_name });
            }
        }
        
        console.log(`Found ${csvCustomers.length} customers in CSV`);

        // Fetch all customers from MongoDB
        console.log('Fetching customers from MongoDB...');
        const mongoCustomers = await Customer.find({}).lean();
        console.log(`Found ${mongoCustomers.length} customers in MongoDB`);

        // Create a map of ClickUp IDs from MongoDB customers
        const mongoClickupIds = new Set();
        const mongoCustomersMap = new Map(); // Map clickupId -> customer data
        
        mongoCustomers.forEach(customer => {
            const clickupId = customer.CustomerSettings?.customerClickupID || '';
            if (clickupId && clickupId.trim() !== '') {
                mongoClickupIds.add(clickupId.trim());
                mongoCustomersMap.set(clickupId.trim(), {
                    _id: customer._id,
                    customerName: customer.customerName,
                    clickupId: clickupId.trim(),
                    isArchived: customer.isArchived || false
                });
            }
        });

        console.log(`Found ${mongoClickupIds.size} customers with ClickUp IDs in MongoDB`);

        // Compare and categorize
        const existingCustomers = [];
        const missingCustomers = [];

        csvCustomers.forEach(csvCustomer => {
            const clientId = csvCustomer.client_id.trim();
            if (mongoClickupIds.has(clientId)) {
                const mongoCustomer = mongoCustomersMap.get(clientId);
                existingCustomers.push({
                    clickup_id: clientId,
                    clickup_name: csvCustomer.client_name,
                    mongo_id: mongoCustomer._id.toString(),
                    mongo_name: mongoCustomer.customerName,
                    is_archived: mongoCustomer.isArchived
                });
            } else {
                missingCustomers.push({
                    clickup_id: clientId,
                    clickup_name: csvCustomer.client_name
                });
            }
        });

        // Export results
        const outputDir = path.join(__dirname);
        
        // Export existing customers
        const existingCsv = [
            'clickup_id,clickup_name,mongo_id,mongo_name,is_archived',
            ...existingCustomers.map(c => 
                `"${c.clickup_id}","${c.clickup_name}","${c.mongo_id}","${c.mongo_name}",${c.is_archived}`
            )
        ].join('\n');
        
        const existingPath = path.join(outputDir, 'existing_customers.csv');
        fs.writeFileSync(existingPath, existingCsv, 'utf-8');
        console.log(`\n✅ Exported ${existingCustomers.length} existing customers to: ${existingPath}`);

        // Export missing customers
        const missingCsv = [
            'clickup_id,clickup_name',
            ...missingCustomers.map(c => 
                `"${c.clickup_id}","${c.clickup_name}"`
            )
        ].join('\n');
        
        const missingPath = path.join(outputDir, 'missing_customers.csv');
        fs.writeFileSync(missingPath, missingCsv, 'utf-8');
        console.log(`✅ Exported ${missingCustomers.length} missing customers to: ${missingPath}`);

        // Print summary
        console.log('\n=== SUMMARY ===');
        console.log(`Total customers in ClickUp CSV: ${csvCustomers.length}`);
        console.log(`Customers found in MongoDB: ${existingCustomers.length}`);
        console.log(`Customers NOT found in MongoDB: ${missingCustomers.length}`);
        
        // Print some examples
        if (existingCustomers.length > 0) {
            console.log('\n--- Sample Existing Customers (first 5) ---');
            existingCustomers.slice(0, 5).forEach(c => {
                console.log(`  ${c.clickup_name} (${c.clickup_id}) -> ${c.mongo_name}`);
            });
        }
        
        if (missingCustomers.length > 0) {
            console.log('\n--- Sample Missing Customers (first 5) ---');
            missingCustomers.slice(0, 5).forEach(c => {
                console.log(`  ${c.clickup_name} (${c.clickup_id})`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

compareClickupCustomers();
