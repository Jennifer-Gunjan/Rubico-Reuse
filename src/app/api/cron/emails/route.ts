import { NextResponse, type NextRequest } from "next/server";
import { checkOutbox } from "@/lib/health";
import { flushOutbox } from "@/lib/outbox";

// Retry sweep. Vercel Cron sends "Authorization: Bearer $CRON_SECRET". No secret set means the route stays closed.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const sent = await flushOutbox();
  // Report a stuck queue to the product owner: the sweep itself never throws,
  // so without this a dead SMTP account is completely silent.
  const health = await checkOutbox();
  return NextResponse.json({ ...sent, health });
}
