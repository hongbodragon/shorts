import { NextRequest, NextResponse } from "next/server";
import { getAiSettings, upsertAiSettings } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getAiSettings());
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  upsertAiSettings({ channel_id: null, ...data });
  return NextResponse.json({ ok: true });
}
