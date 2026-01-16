import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import connectToDatabase from "../../../../../lib/mongodb.js";
import User from "../../../../../models/User.js";
import bcrypt from "bcryptjs";

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
	],
	pages: {
		signIn: "/login",
		error: "/login", // Show errors on login page
	},
	session: {
		strategy: "jwt",
	},
	callbacks: {
		async jwt({ token, user, trigger, session }) {
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
			}
			// Handle client-side session updates (useSession().update)
			if (trigger === 'update' && session?.user) {
				const u = session.user;
				if (typeof u.name === 'string') token.name = u.name;
				if (typeof u.email === 'string') token.email = u.email;
				if (typeof u.image === 'string') token.image = u.image;
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
				slackId: token.slackId,
				clickupId: token.clickupId,
			};
			return session;
		},
	},
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
