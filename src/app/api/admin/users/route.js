import { NextResponse } from 'next/server';
import dbConnect from "../../../../../lib/mongodb"
import { adminUpdateUser } from '../../../../../lib/userService';

// PUT /api/admin/users - Update a user (admin level)
export async function PUT(request) {
    try {
        await dbConnect();

        const body = await request.json();
        const { userId, ...updateData } = body;

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        const updatedUser = await adminUpdateUser(userId, updateData);

        if (!updatedUser) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            user: updatedUser
        });

    } catch (error) {
        console.error('Admin user update error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}