import { createHash } from "node:crypto";
import { currentUser } from "@/lib/auth/server";
import { getCompanyLogos } from "@/features/catalogue/server";
// Every logo for the visible cards in one round trip. The per-card route still
// exists for single views, but the directory must not pay middleware session
// validation plus a pooled transaction per image.
export async function GET(request: Request) {
  if (!(await currentUser()))
    return Response.json(
      { error: "Log in required" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  const slugs = new URL(request.url).searchParams.getAll("slug").slice(0, 64);
  try {
    const logos = await getCompanyLogos(slugs);
    const names = Object.keys(logos).sort();
    const etag =
      '"' +
      createHash("sha256")
        .update(names.map((name) => name + logos[name].sha256).join("|"))
        .digest("hex")
        .slice(0, 32) +
      '"';
    const headers = new Headers({
      "Cache-Control": "private, max-age=3600, must-revalidate",
      ETag: etag,
    });
    if (request.headers.get("if-none-match") === etag)
      return new Response(null, { status: 304, headers });
    return Response.json({ logos }, { headers });
  } catch {
    return Response.json(
      { error: "Logos are temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
