import { NextRequest, NextResponse } from "next/server";
import { getDb, getApiKeys } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const db = getDb();

  // video_id 저장 요청이면 저장 후 즉시 반환
  if (body.youtube_video_id !== undefined) {
    db.prepare("UPDATE articles SET youtube_video_id = ? WHERE id = ?")
      .run(body.youtube_video_id || null, Number(id));
    return NextResponse.json({ ok: true });
  }

  // 반응 수집 요청
  const article = db
    .prepare("SELECT youtube_video_id FROM articles WHERE id = ?")
    .get(Number(id)) as { youtube_video_id: string | null } | undefined;

  if (!article) return NextResponse.json({ error: "기사를 찾을 수 없습니다." }, { status: 404 });
  if (!article.youtube_video_id)
    return NextResponse.json({ error: "YouTube 영상 ID가 없습니다." }, { status: 400 });

  // YouTube Data API 키 조회 (service_name = 'youtube_data')
  const keys = getApiKeys("youtube_data") as Array<{ api_key: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active)
    return NextResponse.json(
      { error: "YouTube Data API 키가 없습니다. 설정 > API 키에서 서비스명 'youtube_data'로 등록해주세요." },
      { status: 400 }
    );

  const videoId = article.youtube_video_id;

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${active.api_key}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YouTube API 오류: ${res.status} ${text}`);
    }
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) throw new Error("영상을 찾을 수 없습니다. video_id를 확인해주세요.");

    const stats = {
      views: Number(item.statistics.viewCount ?? 0),
      likes: Number(item.statistics.likeCount ?? 0),
      comments: Number(item.statistics.commentCount ?? 0),
      checked_at: new Date().toISOString(),
    };

    db.prepare("UPDATE articles SET youtube_stats = ? WHERE id = ?").run(
      JSON.stringify(stats),
      Number(id)
    );

    return NextResponse.json(stats);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDb()
    .prepare("SELECT youtube_video_id, youtube_stats FROM articles WHERE id = ?")
    .get(Number(id)) as { youtube_video_id: string | null; youtube_stats: string | null } | undefined;

  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    youtube_video_id: row.youtube_video_id,
    stats: row.youtube_stats ? JSON.parse(row.youtube_stats) : null,
  });
}
