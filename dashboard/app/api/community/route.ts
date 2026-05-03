import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const categoryId = Number(req.nextUrl.searchParams.get("categoryId") ?? 1);
  const rows = getDb()
    .prepare(
      `SELECT id, source, title, url, comment_cnt, view_cnt, collected_at
       FROM community_posts
       WHERE category_id = ? AND source = 'damoang'
       ORDER BY comment_cnt DESC, collected_at DESC
       LIMIT 50`
    )
    .all(categoryId);
  return NextResponse.json(rows);
}
