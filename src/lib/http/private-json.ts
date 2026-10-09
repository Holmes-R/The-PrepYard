import "server-only";
import { currentUser, withAuthRequest } from "@/lib/auth/server";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
type User = NonNullable<Awaited<ReturnType<typeof currentUser>>>;
export function privateJson(operation: (user: User) => Promise<unknown>) {
  return withAuthRequest(async () => {
    const user = await currentUser();
    if (!user)
      return Response.json(
        { error: "Log in required" },
        { status: 401, headers },
      );
    try {
      const data = await operation(user);
      return data === null
        ? Response.json({ error: "Page not found" }, { status: 404, headers })
        : Response.json(data, { headers });
    } catch {
      return Response.json(
        { error: "Content is temporarily unavailable" },
        { status: 503, headers },
      );
    }
  });
}
