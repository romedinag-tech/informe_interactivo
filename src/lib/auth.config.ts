import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Configuración base, SIN el proveedor de credenciales (que usa Prisma/bcrypt y
// no es compatible con el runtime Edge del middleware). El proveedor real se
// agrega en `auth.ts`, que solo corre en Node (rutas / server actions).
// El middleware construye su propio NextAuth con esta base para verificar la
// sesión (decodificar el JWT) sin tocar la base de datos.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true, // confía en el host de Vercel/producción
  providers: [], // se completan en auth.ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.uid = user.id as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
