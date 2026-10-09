export const dynamic = "force-dynamic";
// The proxy validates the session before serving protected page shells.
// Private APIs and server actions independently authorize their data operations.
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
