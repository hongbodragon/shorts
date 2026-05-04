import { NextRequest, NextResponse } from "next/server";
import { getApiKeys } from "@/lib/db";

const REGION_LABELS: Record<string, string> = {
  US: "🇺🇸 미국", JP: "🇯🇵 일본", GB: "🇬🇧 영국",
  FR: "🇫🇷 프랑스", DE: "🇩🇪 독일", IN: "🇮🇳 인도",
  AU: "🇦🇺 호주", CA: "🇨🇦 캐나다", BR: "🇧🇷 브라질",
};

export const SUPPORTED_REGIONS = Object.keys(REGION_LABELS);

// ISO 8601 duration → 초 변환 (PT1H2M3S)
function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const regionCode = searchParams.get("regionCode") ?? "US";
  const maxResults = Math.min(Number(searchParams.get("maxResults") ?? 20), 50);

  const keys = getApiKeys("youtube_data") as Array<{ api_key: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active) {
    return NextResponse.json(
      { error: "YouTube Data API 키가 없습니다. 설정 > API 키에서 서비스명 'youtube_data'로 등록해주세요." },
      { status: 400 }
    );
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,statistics,contentDetails");
  url.searchParams.set("chart", "mostPopular");
  url.searchParams.set("regionCode", regionCode);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("key", active.api_key);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YouTube API 오류: ${res.status} ${text}`);
    }
    const data = await res.json();

    const items = (data.items ?? []).map((item: Record<string, unknown>) => {
      const snippet = item.snippet as Record<string, unknown>;
      const stats = item.statistics as Record<string, unknown>;
      const content = item.contentDetails as Record<string, unknown>;
      const thumbnails = snippet.thumbnails as Record<string, { url: string }>;
      return {
        videoId: item.id as string,
        title: snippet.title as string,
        description: ((snippet.description as string) ?? "").slice(0, 300),
        thumbnail: thumbnails?.maxres?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url ?? "",
        channelTitle: snippet.channelTitle as string,
        publishedAt: snippet.publishedAt as string,
        viewCount: Number(stats?.viewCount ?? 0),
        likeCount: Number(stats?.likeCount ?? 0),
        commentCount: Number(stats?.commentCount ?? 0),
        duration: parseDuration(content?.duration as string ?? ""),
        regionCode,
        regionLabel: REGION_LABELS[regionCode] ?? regionCode,
      };
    });

    // 숏츠(60초 이하) 제외 옵션 - 기본 포함
    return NextResponse.json({ items, regionLabel: REGION_LABELS[regionCode] ?? regionCode });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
