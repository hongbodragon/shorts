import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDb()
    .prepare(
      `SELECT a.*, w.stage, w.is_ab_test, w.channel_id
       FROM articles a
       LEFT JOIN workflow_state w ON w.article_id = a.id
       WHERE a.id = ?`
    )
    .get(Number(id));

  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const allowed = ["shorts_title", "script", "script_requirements", "tts_path", "image_paths", "impact_subtitles", "youtube_video_id", "youtube_stats"];

  for (const key of allowed) {
    if (key in body) {
      db.prepare(`UPDATE articles SET ${key} = ? WHERE id = ?`).run(body[key], Number(id));
    }
  }
  return NextResponse.json({ ok: true });
}
