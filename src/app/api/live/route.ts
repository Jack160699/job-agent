import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "kairela",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Server-Timing": "app;dur=0;desc=\"liveness\", total;dur=0",
        "X-Kairela-Server-Timing":
          "app;dur=0;desc=\"liveness\", total;dur=0",
      },
    }
  );
}
