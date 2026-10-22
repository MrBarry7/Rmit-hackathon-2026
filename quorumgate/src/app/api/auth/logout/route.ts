import { clearedCookie, destroySession, readSessionCookie } from "@/lib/auth/local";

export async function POST(req: Request) {
  destroySession(readSessionCookie(req));
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearedCookie() } });
}
