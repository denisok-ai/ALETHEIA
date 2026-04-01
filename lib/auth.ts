/**
 * NextAuth — локальная аутентификация (credentials).
 */
import type { NextAuthOptions } from 'next-auth';

if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_SECRET?.trim()) {
  throw new Error('NEXTAUTH_SECRET must be set in production. Do not use dev fallback.');
}
import { getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from './db';
import { closeVisit } from './visits';

/** Расширение session.user (id, role задаются в callbacks). */
export type SessionUser = { id?: string; role?: string; email?: string | null; name?: string | null };

/** NEXTAUTH_URL подставляется из БД (site_url / nextauth_url) в lib/settings и instrumentation — см. applyNextAuthUrlToProcessEnv. */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Пароль', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { profile: true },
        });
        if (!user || !user.passwordHash) return null;
        const ok = await compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? user.email,
          role: user.profile?.role ?? 'user',
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    signOut: '/signout',
  },
  events: {
    signOut: async ({ token }) => {
      const userId = token?.sub;
      if (userId) await closeVisit(userId);
    },
  },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  secret:
    process.env.NODE_ENV === 'production'
      ? process.env.NEXTAUTH_SECRET!
      : process.env.NEXTAUTH_SECRET ?? 'avaterra-dev-secret',
};

export type Profile = {
  role: string;
  display_name?: string | null;
  email?: string | null;
};

export async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { user: null, profile: null };
  const user = session.user as SessionUser;
  const profile: Profile = {
    role: user.role ?? 'user',
    display_name: session.user.name ?? null,
    email: session.user.email ?? null,
  };
  return {
    user: { id: user.id, email: session.user.email },
    profile,
  };
}

/**
 * Проверка сессии и роли admin для API. Возвращает данные сессии или null (тогда маршрут должен вернуть 403).
 */
export async function requireAdminSession(): Promise<
  { session: Awaited<ReturnType<typeof getServerSession>>; userId: string; role: string } | null
> {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!session?.user || !user?.id || user.role !== 'admin') return null;
  return { session, userId: user.id, role: user.role };
}

/**
 * Проверка сессии и роли manager или admin для API. Возвращает данные сессии или null.
 */
export async function requireManagerSession(): Promise<
  { session: Awaited<ReturnType<typeof getServerSession>>; userId: string; role: string } | null
> {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!session?.user || !user?.id) return null;
  if (user.role !== 'manager' && user.role !== 'admin') return null;
  return { session, userId: user.id, role: user.role };
}
