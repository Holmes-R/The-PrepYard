import { listCompanies } from "@/features/catalogue/server";
import { privateJson } from "@/lib/http/private-json";
export const dynamic = "force-dynamic";
export async function GET() {
  return privateJson(() => listCompanies());
}
