import type { Metadata } from "next";
import { ClientNotes } from "@/components/client/notes";
export const metadata: Metadata = { title: "Notes" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <ClientNotes
      requested={Array.isArray(params.page) ? params.page[0] : params.page}
    />
  );
}
