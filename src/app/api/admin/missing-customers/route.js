import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        // Path to the missing customers CSV file
        const csvPath = path.join(process.cwd(), 'scripts', 'clickup', 'missing_customers.csv');
        
        // Check if file exists
        if (!fs.existsSync(csvPath)) {
            return Response.json({ error: 'Missing customers CSV file not found' }, { status: 404 });
        }

        // Read and parse CSV
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        const missingCustomers = [];
        
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Parse CSV line (handling quoted values)
            const match = line.match(/^"([^"]+)","(.+)"$/);
            if (match) {
                missingCustomers.push({
                    clickup_id: match[1],
                    clickup_name: match[2]
                });
            }
        }

        return Response.json(missingCustomers);
    } catch (error) {
        console.error('Error reading missing customers CSV:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
