import { NextRequest, NextResponse } from "next/server";
import { getApiKeys } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const licenseOnly = searchParams.get("cc") !== "false"; // 기본값: CC만

  if (!q.trim()) return NextResponse.json({ items: [] });

  const keys = getApiKeys("youtube_data") as Array<{ api_key: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active) {
    return NextResponse.json(
      { error: "YouTube Data API 키가 없습니다." },
      { status: 400 }
    );
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", q);
  url.searchParams.set("maxResults", "20");
  url.searchParams.set("key", active.api_key);
  if (licenseOnly) url.searchParams.set("videoLicense", "creativeCommon");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YouTube API 오류: ${res.status} ${text}`);
    }
    const data = await res.json();

    const items = (data.items ?? []).map((item: Record<string, unknown>) => {
      const id = item.id as { videoId: string };
      const snippet = item.snippet as Record<string, unknown>;
      const thumbnails = snippet.thumbnails as Record<string, { url: string }>;
      return {
        videoId: id.videoId,
        title: snippet.title as string,
        channelTitle: snippet.channelTitle as string,
        publishedAt: snippet.publishedAt as string,
        thumbnail: thumbnails?.high?.url ?? thumbnails?.medium?.url ?? "",
        description: ((snippet.description as string) ?? "").slice(0, 200),
      };
    });

    return NextResponse.json({ items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
