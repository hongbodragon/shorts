import { NextRequest, NextResponse } from "next/server";
import { getChannels, addChannel, toggleChannel } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getChannels());
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  if (!data.name || !data.youtube_channel_id) return NextResponse.json({ error: "missing fields" }, { status: 400 });
  addChannel(data);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { id, is_active } = await req.json();
  toggleChannel(id, is_active);
  return NextResponse.json({ ok: true });
}
