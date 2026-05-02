import { NextRequest, NextResponse } from "next/server";
import { getApiKeys, addApiKey, updateApiKey, deleteApiKey } from "@/lib/db";

export async function GET(req: NextRequest) {
  const service = req.nextUrl.searchParams.get("service") ?? undefined;
  return NextResponse.json(getApiKeys(service));
}

export async function POST(req: NextRequest) {
  const { service_name, api_key, key_label, extra } = await req.json();
  if (!service_name || !api_key) return NextResponse.json({ error: "missing fields" }, { status: 400 });
  addApiKey(service_name, api_key, key_label ?? "", extra);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { id, ...fields } = await req.json();
  updateApiKey(id, fields);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  deleteApiKey(id);
  return NextResponse.json({ ok: true });
}
