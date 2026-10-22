import { AuthError, createSession, logIn, sessionCookie } from "@/lib/auth/local";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const user = logIn(body.email, body.password);
    const s = createSession(user.id);
    return Response.json({ user }, { headers: { "Set-Cookie": sessionCookie(s.id, s.expires) } });
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
