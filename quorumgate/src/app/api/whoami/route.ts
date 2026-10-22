import { withAdmin } from "@/lib/quorum/serverStore";

// Who am I, according to the SERVER (works for TideCloak and local login). Used by the live
// console to decide between the pending screen and the full console.
export const GET = withAdmin((_req, { user, via }) => Response.json({ user, via }));
