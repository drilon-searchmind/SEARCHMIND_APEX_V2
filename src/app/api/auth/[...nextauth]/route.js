import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import connectToDatabase from "../../../../../lib/mongodb.js";
import User from "../../../../../models/User.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Helper function to generate a random password
function generateRandomPassword() {
	return crypto.randomBytes(16).toString('base64').slice(0, 16);
}

export const authOptions = {
	providers: [
		CredentialsProvider({
			name: "Credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				await connectToDatabase();
				const user = await User.findOne({ email: credentials.email });
				if (!user) {
					throw new Error("Invalid email or password");
				}
				const isValid = await bcrypt.compare(credentials.password, user.password);
				if (!isValid) {
					throw new Error("Invalid email or password");
				}
				// Exclude password from session
				const { password, ...userSafe } = user.toObject();
				return userSafe;
			},
		}),
		GoogleProvider({
			clientId: process.env.SSO_GOOGLE_CLIENT_ID,
			clientSecret: process.env.SSO_GOOGLE_CLIENT_SECRET,
		}),
	],
	pages: {
		signIn: "/login",
		error: "/login", // Show errors on login page
	},
	session: {
		strategy: "jwt",
	},
	callbacks: {
		async signIn({ user, account, profile }) {
			// Only allow Google SSO for @searchmind.dk emails
			if (account?.provider === 'google') {
				if (!user.email || !user.email.endsWith('@searchmind.dk')) {
					return false; // Reject non-searchmind.dk emails
				}
				
				await connectToDatabase();
				
				// Check if user exists
				let dbUser = await User.findOne({ email: user.email });
				
				if (!dbUser) {
					// Generate random password
					const randomPassword = generateRandomPassword();
					
					// Create new user (password will be hashed by User model's pre-save hook)
					dbUser = new User({
						name: user.name || profile?.name || 'User',
						email: user.email,
						password: randomPassword, // Will be hashed by pre-save hook
						image: user.image || profile?.picture,
						isAdmin: false,
						isArchived: false,
						isExternal: false,
					});
					
					await dbUser.save();
					
					// Store the plain password in the user object temporarily (will be passed to session)
					user.tempPassword = randomPassword;
					user._id = dbUser._id;
				}
				
				// Update user object with DB user data
				user._id = dbUser._id;
				user.isAdmin = dbUser.isAdmin;
				user.isArchived = dbUser.isArchived;
				user.isExternal = dbUser.isExternal;
				user.slackId = dbUser.slackId;
				user.clickupId = dbUser.clickupId;
				
				return true;
			}
			
			// Allow credentials provider
			return true;
		},
		async jwt({ token, user, trigger, session, account }) {
			if (user) {
				token.id = user._id;
				token.name = user.name;
				token.email = user.email;
				token.image = user.image;
				token.isAdmin = user.isAdmin;
				token.isArchived = user.isArchived;
				token.isExternal = user.isExternal;
				token.slackId = user.slackId;
				token.clickupId = user.clickupId;
				
				// Store tempPassword if this is a new Google SSO user
				if (user.tempPassword && account?.provider === 'google') {
					token.tempPassword = user.tempPassword;
					token.isNewGoogleUser = true;
				}
			}
			// Handle client-side session updates (useSession().update)
			if (trigger === 'update' && session?.user) {
				const u = session.user;
				if (typeof u.name === 'string') token.name = u.name;
				if (typeof u.email === 'string') token.email = u.email;
				if (typeof u.image === 'string') token.image = u.image;
				// Clear tempPassword if explicitly cleared in session update
				if (session.user.clearTempPassword) {
					delete token.tempPassword;
					delete token.isNewGoogleUser;
				}
			}
			return token;
		},
		async session({ session, token }) {
			await connectToDatabase();
			// Fetch user from DB to get sharedCustomers
			const userFromDb = await User.findOne({ email: token.email });
			session.user = {
				id: token.id,
				name: token.name,
				email: token.email,
				image: token.image,
				isAdmin: token.isAdmin,
				isArchived: token.isArchived,
				isExternal: token.isExternal,
				sharedCustomers: userFromDb?.sharedCustomers || [],
				favoritedCustomers: userFromDb?.favoritedCustomers || [],
				openedWrappedPeriods: (() => {
					const raw = userFromDb?.openedWrappedPeriods;
					if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
						try {
							return JSON.parse(JSON.stringify(raw));
						} catch {
							return {};
						}
					}
					return {};
				})(),
				slackId: token.slackId,
				clickupId: token.clickupId,
			};
			
			// Include tempPassword if this is a new Google SSO user (one-time display)
			if (token.isNewGoogleUser && token.tempPassword) {
				session.user.tempPassword = token.tempPassword;
				session.user.isNewGoogleUser = true;
			}
			
			return session;
		},
	},
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
