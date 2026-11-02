import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "MODERATOR" | "ADMIN";
      username: string | null;
    } & DefaultSession["user"];
  }
}
