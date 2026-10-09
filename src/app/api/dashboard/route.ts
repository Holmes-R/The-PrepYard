import { dashboardData } from "@/features/dashboard/queries";
import { withStudentDatabase } from "@/lib/database/server";
import { privateJson } from "@/lib/http/private-json";
export const dynamic = "force-dynamic";
export async function GET() {
  return privateJson(async (user) => ({
    ...(await withStudentDatabase(dashboardData)),
    user: { id: user.id, name: user.name },
  }));
}
