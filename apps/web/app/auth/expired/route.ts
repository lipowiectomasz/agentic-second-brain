import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { clearSessionCookie } from "@/lib/auth/session-cookie";

export async function GET(request: NextRequest): Promise<never> {
  await clearSessionCookie();
  redirect(`/login?next=${encodeURIComponent(safeNextPath(request.nextUrl.searchParams.get("next")))}`);
}
