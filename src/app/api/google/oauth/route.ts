import { NextResponse } from "next/server";
import { resolveApiUserDev } from "@/lib/api/auth";
import { getAuthUrl } from "@/lib/google/oauth";

export async function GET() {
  try {
    const user = await resolveApiUserDev();
    const url = getAuthUrl(user.id);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
