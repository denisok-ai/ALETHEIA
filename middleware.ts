/**
 * Middleware: refresh Supabase session and RBAC for /portal/*.
 * - /portal/* requires auth; redirect to /login if no session.
 * - /portal/admin/* requires role admin.
 * - /portal/manager/* requires role manager or admin.
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PORTAL_PREFIX = '/portal';
const LOGIN_PATH = '/login';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  if (!request.nextUrl.pathname.startsWith(PORTAL_PREFIX)) {
    return response;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = (profile?.role as 'user' | 'manager' | 'admin') ?? 'user';
  const path = request.nextUrl.pathname;

  if (path.startsWith(`${PORTAL_PREFIX}/admin`)) {
    if (role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/portal/student/dashboard';
      return NextResponse.redirect(url);
    }
  }

  if (path.startsWith(`${PORTAL_PREFIX}/manager`)) {
    if (role !== 'manager' && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/portal/student/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
