import connectToDatabase from '../lib/mongodb.js';
import User from '../models/User.js';

async function createUser() {
    await connectToDatabase();

    const newUser = new User({
        name: 'John Doe',
        email: 'johndoe@example.com',
        password: 'securepassword', // In a real-world app, hash the password before saving
        image: 'https://example.com/image.jpg',
        isAdmin: false,
        isArchived: false,
        isExternal: false,
    });

    try {
        const savedUser = await newUser.save();
        console.log('User created successfully:', savedUser);
    } catch (error) {
        console.error('Error creating user:', error);
    }
}

createUser();