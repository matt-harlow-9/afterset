import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Spotify from "next-auth/providers/spotify";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const resendKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;

const providers: Provider[] = [
  Credentials({
    credentials: { email: {}, password: {} },
    async authorize(raw) {
      const parsed = z
        .object({ email: z.string().email(), password: z.string().min(1) })
        .safeParse(raw);
      if (!parsed.success) return null;
      const user = await db.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
      });
      if (!user?.passwordHash) return null;
      const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
      return ok ? user : null;
    },
  }),
];

// Optional providers: only enabled when configured, so local dev works with nothing set.
if (resendKey) {
  providers.push(Resend({ apiKey: resendKey, from: process.env.EMAIL_FROM }));
}
if (process.env.AUTH_GOOGLE_ID) providers.push(Google({ allowDangerousEmailAccountLinking: true }));
if (process.env.AUTH_SPOTIFY_ID) providers.push(Spotify({ allowDangerousEmailAccountLinking: true }));
// Apple: add once an Apple Developer account exists (requires paid membership).

export const enabledProviders = {
  magicLink: !!resendKey,
  google: !!process.env.AUTH_GOOGLE_ID,
  spotify: !!process.env.AUTH_SPOTIFY_ID,
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" }, // required for the Credentials provider
  providers,
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
        const u = await db.user.findUnique({
          where: { id: token.sub },
          select: { role: true, username: true },
        });
        session.user.role = u?.role ?? "USER";
        session.user.username = u?.username ?? null;
      }
      return session;
    },
  },
});
