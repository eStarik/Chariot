import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import Keycloak from "next-auth/providers/keycloak";

// Conditionally use the DB adapter — JWT strategy works without it for OIDC-only flows
const adapterConfig = process.env.DATABASE_URL
  ? { adapter: DrizzleAdapter(db) }
  : {};

export const authOptions = {
  ...adapterConfig,
  session: { strategy: "jwt" as const },
  trustHost: true, // Crucial for NGINX proxy scenarios
  providers: [
    // OIDC Provider: Keycloak (Primary)
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer: process.env.AUTH_KEYCLOAK_ISSUER,
    }),
    
    // Legacy/Local Credentials Fallback
    Credentials({
      name: "Chariot Native",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1);

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(credentials.password as string, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role || 'commander';
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }: any) {
      const isLoggedIn = !!auth?.user;
      const isSetupPage = nextUrl.pathname === "/setup";
      const isLoginPage = nextUrl.pathname === "/login";
      const isApiRoute = nextUrl.pathname.startsWith("/api");

      if (isLoginPage || isSetupPage || isApiRoute) {
        return true;
      }

      return isLoggedIn;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
