import { readSessionCookie, userFromSession } from "@/lib/auth/local";

export async function GET(req: Request) {
  const user = userFromSession(readSessionCookie(req));
  if (!user) return Response.json({ user: null }, { status: 401 });
  const { sessionId: _s, ...safe } = user;
  void _s;
  return Response.json({ user: safe });
}
