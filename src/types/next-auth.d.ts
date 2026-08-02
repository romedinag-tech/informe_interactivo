import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Extiende los tipos de Auth.js para incluir id y role en la sesión y el token.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: Role;
  }
}
