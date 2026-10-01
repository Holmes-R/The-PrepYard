export function GET() {
  return Response.json({
    status: "ok",
    application: "the-prepyard",
    stage: "scaffold",
  });
}
