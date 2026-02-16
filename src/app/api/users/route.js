import connectToDatabase from '../../../../lib/mongodb';
import User from '../../../../models/User';

export async function GET(req) {
    try {
        await connectToDatabase();
        const url = new URL(req.url, 'http://localhost');
        const externalOnly = url.searchParams.get('externalOnly');
        let users;
        if (externalOnly === 'true') {
            users = await User.find({ isExternal: true }).select('-password');
        } else {
            users = await User.find().select('-password');
        }
        return new Response(JSON.stringify(users), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

export async function PUT(req) {
    try {
        await connectToDatabase();
        const { userId, customerId, action } = await req.json();
        if (!userId || !customerId || !['add', 'remove'].includes(action)) {
            return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400 });
        }
        const update =
            action === 'add'
                ? { $addToSet: { sharedCustomers: customerId } }
                : { $pull: { sharedCustomers: customerId } };
        const user = await User.findByIdAndUpdate(userId, update, { new: true }).select('-password');
        if (!user) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        return new Response(JSON.stringify(user), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

export async function POST(req) {
    try {
        await connectToDatabase();
        const body = await req.json();
        const { name, email, password } = body;
        if (!name || !email) {
            return new Response(JSON.stringify({ error: 'Missing name or email' }), { status: 400 });
        }

        // Use the userService helper to create the external user
        const { createExternalUser } = await import('../../../../lib/userService');
        const created = await createExternalUser({ name, email, password });
        return new Response(JSON.stringify(created), { status: 201 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
