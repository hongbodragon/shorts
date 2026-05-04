import { NextResponse } from "next/server";
import { getCategories } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(getCategories());
  } catch (e) {
    console.error("[/api/categories] DB error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
