// src/app/api/clickup-team-members/[customerId]/route.js
import Customer from '@/models/Customer';
import connectToDatabase from '../../../../../lib/mongodb';

export async function GET(request, { params }) {
    try {
        await connectToDatabase();
        const resolvedParams = await params;
        const customerId = resolvedParams.customerId;

        // Fetch the customer to get their ClickUp ID
        const customer = await Customer.findById(customerId);
        
        if (!customer) {
            return Response.json({ error: 'Customer not found' }, { status: 404 });
        }

        const clickupId = customer?.CustomerSettings?.customerClickupID;
        
        if (!clickupId) {
            return Response.json({ members: [] }, { status: 200 });
        }

        // Fetch the team data from ClickUp
        const clickupUrl = `https://api.clickup.com/api/v2/task/${clickupId}`;
        const clickupResponse = await fetch(clickupUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': process.env.CLICKUP_API_TOKEN
            }
        });

        if (!clickupResponse.ok) {
            console.warn(`ClickUp API error for task ${clickupId}:`, clickupResponse.status);
            return Response.json({ members: [] }, { status: 200 });
        }

        const clickupData = await clickupResponse.json();

        // Service field IDs
        const userFields = [
            "51ed563e-4a2c-489b-9506-be385c49a354", // SEO
            "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e", // PPC
            "2df85265-d5eb-4e86-a111-5d55623851fa", // PS
            "55b3e92d-5972-4246-8160-73d7ba04401a", // EM
            "28b06356-6f19-4633-bfa4-416c150a562c", // Client Lead
        ];

        const serviceMap = {
            "51ed563e-4a2c-489b-9506-be385c49a354": "SEO",
            "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": "PPC",
            "2df85265-d5eb-4e86-a111-5d55623851fa": "PS",
            "55b3e92d-5972-4246-8160-73d7ba04401a": "EM",
            "28b06356-6f19-4633-bfa4-416c150a562c": "Client Lead",
        };

        const membersMap = new Map(); // Use Map to deduplicate by user ID

        if (clickupData.custom_fields) {
            clickupData.custom_fields.forEach(field => {
                if (userFields.includes(field.id) && field.value) {
                    const serviceLabel = serviceMap[field.id] || field.name;

                    // Handle Client Lead special case
                    if (field.id === "28b06356-6f19-4633-bfa4-416c150a562c") {
                        const matchedOption = field.type_config?.options?.find(
                            option => option.orderindex === field.value
                        );
                        if (matchedOption) {
                            const userId = matchedOption.id;
                            if (!membersMap.has(userId)) {
                                membersMap.set(userId, {
                                    id: userId,
                                    username: matchedOption.name,
                                    service: field.id,
                                    avatar: null
                                });
                            }
                        }
                    } else if (Array.isArray(field.value)) {
                        // Handle array of users
                        field.value.forEach(user => {
                            const userId = user.id;
                            if (!membersMap.has(userId)) {
                                membersMap.set(userId, {
                                    id: userId,
                                    username: user.username,
                                    service: field.id,
                                    avatar: user.avatar || null
                                });
                            }
                        });
                    } else {
                        // Handle single user value
                        const userId = field.value;
                        if (!membersMap.has(userId)) {
                            membersMap.set(userId, {
                                id: userId,
                                username: field.name,
                                service: field.id,
                                avatar: null
                            });
                        }
                    }
                }
            });
        }

        const members = Array.from(membersMap.values());

        return Response.json({ members }, { status: 200 });
    } catch (error) {
        console.error('Error fetching team members:', error);
        return Response.json({ error: error.message, members: [] }, { status: 500 });
    }
}