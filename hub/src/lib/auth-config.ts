import NextAuth, { customFetch } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Keycloak from "next-auth/providers/keycloak";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Conditionally use the DB adapter — JWT strategy works without it for OIDC-only flows
const adapterConfig = process.env.DATABASE_URL
  ? { adapter: DrizzleAdapter(db) }
  : {};

// Custom fetch to route OIDC calls correctly between Internal (Cluster) and External (Browser) URLs
const oidcFetch = (url: string | Request | URL, init?: RequestInit) => {
  const urlString = url.toString();
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER || "";
  const serverUrl = process.env.AUTH_KEYCLOAK_SERVER_URL || "";

  if (issuer && serverUrl && urlString.startsWith(issuer)) {
    const internalUrl = urlString.replace(issuer, `${serverUrl}/realms/chariot`);
    return fetch(internalUrl, init);
  }
  return fetch(url, init);
};

export const authOptions = {
  ...adapterConfig,
  session: { strategy: "jwt" as const },
  providers: [
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
    ...(process.env.AUTH_KEYCLOAK_ID ? [Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer: process.env.AUTH_KEYCLOAK_ISSUER,
      // Provide the custom fetch to ensure discovery and token calls use the internal DNS
      [customFetch]: oidcFetch as any,
      profile(profile) {
        // Extract Admin Groups from the profile
        const userGroups = (profile as any).groups || [];
        const adminGroups = (process.env.AUTH_ADMIN_GROUPS || "").split(",").filter(Boolean);
        const isAdmin = userGroups.some((group: string) => adminGroups.includes(group));

        return {
          id: profile.sub,
          name: profile.name ?? profile.preferred_username,
          email: profile.email,
          image: profile.picture,
          role: isAdmin ? "commander" : "peltast",
        };
      },
    })] : []),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, profile }: any) {
      if (user) {
        token.id = user.id;
        
        // Handle Role Mapping for OIDC users
        if (profile) {
          const userGroups = (profile as any).groups || [];
          const adminGroups = (process.env.AUTH_ADMIN_GROUPS || "").split(",").filter(Boolean);
          const isAdmin = userGroups.some((group: string) => adminGroups.includes(group));
          
          token.role = isAdmin ? "commander" : "peltast";
          
          // Force update the DB role to ensure consistency with SSO claims if DB is configured
          if (process.env.DATABASE_URL) {
            await db.update(users).set({ role: token.role }).where(eq(users.id, user.id));
          }
        } else {
          token.role = user.role || 'commander';
        }
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
