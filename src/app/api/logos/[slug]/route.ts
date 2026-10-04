import { currentUser } from "@/lib/auth/server";
import { getCompanyLogo } from "@/features/catalogue/server";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const notFound = {
  status: 404,
  headers: { "Cache-Control": "private, max-age=3600" },
};
// Logos are shared company metadata rather than student records, so a response may
// be cached by the browser. The stored content hash is the validator, so replacing a
// mark changes the ETag and every client refetches exactly once.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await currentUser()))
    return Response.json(
      { error: "Log in required" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  const { slug } = await params;
  if (!slugPattern.test(slug) || slug.length > 200)
    return Response.json(
      { error: "Company not found" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  try {
    const logo = await getCompanyLogo(slug);
    // Most of the directory has no stored mark. That is the normal case, so the
    // caller falls back to a generated monogram and this must not read as an error.
    if (!logo) return new Response(null, notFound);
    const headers = new Headers({
      "Content-Type": logo.content_type,
      "Cache-Control": "private, max-age=86400, immutable",
      ETag: `"${logo.sha256}"`,
      "Content-Length": String(logo.image.byteLength),
      "X-Content-Type-Options": "nosniff",
    });
    // A stored mark is untrusted third-party artwork. SVG can script, so it is
    // served sandboxed and never same-origin executable content.
    if (logo.content_type === "image/svg+xml")
      headers.set(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      );
    const etag = headers.get("ETag");
    if (etag && request.headers.get("if-none-match") === etag)
      return new Response(null, { status: 304, headers });
    return new Response(logo.image, { status: 200, headers });
  } catch {
    return Response.json(
      { error: "Logo is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
