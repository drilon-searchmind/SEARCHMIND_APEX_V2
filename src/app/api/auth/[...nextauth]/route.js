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
    async jwt({ token, user }) {
      if (user) {
        token.id = user._id;
        token.name = user.name;
        token.email = user.email;
        token.image = user.image;
        token.isAdmin = user.isAdmin;
        token.isArchived = user.isArchived;
        token.isExternal = user.isExternal;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        name: token.name,
        email: token.email,
        image: token.image,
        isAdmin: token.isAdmin,
        isArchived: token.isArchived,
        isExternal: token.isExternal,
      };
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
