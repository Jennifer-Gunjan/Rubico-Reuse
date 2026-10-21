import { NextResponse, type NextRequest } from "next/server";
import { flushOutbox } from "@/lib/outbox";

// Retry sweep. Vercel Cron sends "Authorization: Bearer $CRON_SECRET". No secret set means the route stays closed.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json(await flushOutbox());
}
