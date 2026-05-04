import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// 페이지 HTML에서 og:title 또는 <title> 추출
function extractTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return og[1].trim();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return title ? title[1].trim() : "제목 없음";
}

// 이미지 URL 정규화 (상대경로 → 절대경로)
function resolveUrl(src: string, base: string): string {
  try {
    return new URL(src, base).href;
  } catch {
    return src;
  }
}

// 필터링: 아이콘·버튼 등 제외
function isContentImage(src: string): boolean {
  const lower = src.toLowerCase();
  const blocked = ["icon", "logo", "banner", "button", "avatar", "emoji", "pixel", "tracking", "ads", "ad_", "_ad"];
  if (blocked.some((b) => lower.includes(b))) return false;
  // 데이터 URI, 1x1 트래킹 픽셀 등 제외
  if (src.startsWith("data:")) return false;
  if (!src.startsWith("http")) return false;
  return true;
}

// HTML에서 이미지 src 목록 추출
function extractImages(html: string, baseUrl: string): string[] {
  const results: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  const seen = new Set<string>();
  while ((match = imgRegex.exec(html)) !== null) {
    const raw = match[1];
    const resolved = resolveUrl(raw, baseUrl);
    if (!seen.has(resolved) && isContentImage(resolved)) {
      seen.add(resolved);
      results.push(resolved);
    }
  }
  // og:image도 포함
  const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImg) {
    const resolved = resolveUrl(ogImg[1], baseUrl);
    if (!seen.has(resolved) && isContentImage(resolved)) {
      results.unshift(resolved); // 앞에 추가
    }
  }
  return results;
}

export async function POST(req: NextRequest) {
  const {
    url, categoryId, articleType = "community",
    // 번안 영상일 때 직접 전달 가능
    title: preTitle, description: preDesc, thumbnail: preThumbnail, foreignVideoId,
  } = await req.json();

  if (!url || !categoryId) {
    return NextResponse.json({ error: "url과 categoryId가 필요합니다." }, { status: 400 });
  }

  // 번안 영상: 이미 메타데이터가 있으면 파싱 스킵
  let title = preTitle ?? "";
  let imageCount = 0;
  let communityImages: object[] = [];

  if (!preTitle) {
    let html = "";
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e: unknown) {
      return NextResponse.json({ error: `페이지 로드 실패: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }
    title = extractTitle(html);
    const images = extractImages(html, url);
    imageCount = images.length;
    communityImages = images.map((imgUrl, i) => ({ url: imgUrl, selected: false, order: i }));
  } else if (preThumbnail) {
    // 번안: 썸네일을 이미지로 사용
    communityImages = [{ url: preThumbnail, selected: true, order: 0 }];
    imageCount = 1;
  }

  // source: 도메인 추출
  let source = "커뮤니티";
  try { source = new URL(url).hostname.replace("www.", ""); } catch { /* empty */ }

  const db = getDb();

  // 이미 존재하면 초기화 후 collected로 리셋
  const existing = db.prepare("SELECT id FROM articles WHERE url = ?").get(url) as { id: number } | undefined;
  if (existing) {
    db.prepare(
      "UPDATE articles SET title=?, community_images=?, article_type=?, script=NULL, tts_path=NULL, image_paths=NULL, video_path=NULL WHERE id=?"
    ).run(title || undefined, JSON.stringify(communityImages), articleType, existing.id);
    // stage를 collected로 리셋
    db.prepare(
      "INSERT INTO workflow_state (article_id, stage) VALUES (?, 'collected') ON CONFLICT(article_id) DO UPDATE SET stage='collected', updated_at=datetime('now','localtime')"
    ).run(existing.id);
    return NextResponse.json({ articleId: existing.id, title, imageCount, updated: true });
  }

  const result = db.prepare(
    `INSERT INTO articles (category_id, title, url, source, description, article_type, community_images, foreign_video_id, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`
  ).run(categoryId, title, url, source, preDesc ?? null, articleType, JSON.stringify(communityImages), foreignVideoId ?? null);

  const articleId = result.lastInsertRowid as number;

  // workflow_state 생성
  db.prepare("INSERT OR IGNORE INTO workflow_state (article_id, stage) VALUES (?, 'collected')").run(articleId);

  return NextResponse.json({ articleId, title, imageCount });
}
