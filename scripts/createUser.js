import connectToDatabase from '../lib/mongodb.js';
import User from '../models/User.js';

async function createUser() {
    await connectToDatabase();

    const newUser = new User({
        name: 'Searchmind External Test Dev',
        email: 'searchmindexternaltestdev@gmail.com',
        password: 'securepassword', // In a real-world app, hash the password before saving
        image: '',
        isAdmin: false,
        isArchived: false,
        isExternal: true,
    });

    try {
        const savedUser = await newUser.save();
    } catch (error) {
        console.error('Error creating user:', error);
    }
}

createUser();