import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { title, categoryId } = await req.json();
  if (!title || !categoryId) {
    return NextResponse.json({ error: "title과 categoryId가 필요합니다." }, { status: 400 });
  }

  const db = getDb();
  // 유니크 URL: community://timestamp
  const url = `community://${Date.now()}`;

  const result = db.prepare(
    `INSERT INTO articles (category_id, title, url, source, article_type, published_at)
     VALUES (?, ?, ?, ?, 'community', datetime('now','localtime'))`
  ).run(categoryId, title.trim(), url, "커뮤니티");

  const articleId = result.lastInsertRowid as number;
  db.prepare("INSERT OR IGNORE INTO workflow_state (article_id, stage) VALUES (?, 'collected')").run(articleId);

  return NextResponse.json({ articleId, title });
}
