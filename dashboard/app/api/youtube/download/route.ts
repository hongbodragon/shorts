import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mkdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  const { videoId, start, end, articleId, clipIdx = 0, label, caption } = await req.json();

  if (!videoId || !articleId) {
    return NextResponse.json({ error: "videoId와 articleId가 필요합니다." }, { status: 400 });
  }

  const clipsDir = join(process.cwd(), "..", "data", "clips");
  await mkdir(clipsDir, { recursive: true });

  const filename = `article_${articleId}_clip${clipIdx}_${Date.now()}.mp4`;
  const outputPath = join(clipsDir, filename);

  // yt-dlp 섹션 다운로드
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const sectionArg = start !== undefined && end !== undefined
    ? `--download-sections "*${start}-${end}"`
    : "";

  const cmd = [
    "yt-dlp",
    sectionArg,
    `-f "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best"`,
    `--merge-output-format mp4`,
    `-o "${outputPath}"`,
    `"${ytUrl}"`,
  ].filter(Boolean).join(" ");

  try {
    await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024, timeout: 120000 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // yt-dlp 없으면 친절한 안내
    if (msg.includes("not found") || msg.includes("is not recognized")) {
      return NextResponse.json(
        { error: "yt-dlp가 설치되지 않았습니다. 터미널에서 'winget install yt-dlp' 또는 'pip install yt-dlp'를 실행하세요." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: `다운로드 실패: ${msg}` }, { status: 500 });
  }

  // DB에 클립 정보 추가
  const db = getDb();
  const article = db.prepare("SELECT foreign_video_clips FROM articles WHERE id = ?")
    .get(Number(articleId)) as { foreign_video_clips: string | null } | undefined;

  let clips: object[] = [];
  try { clips = article?.foreign_video_clips ? JSON.parse(article.foreign_video_clips) : []; } catch { /* empty */ }

  clips[clipIdx] = { videoId, start, end, clipPath: outputPath, filename, label: label ?? null, caption: caption ?? null };

  db.prepare("UPDATE articles SET foreign_video_clips = ?, foreign_video_id = ? WHERE id = ?")
    .run(JSON.stringify(clips), videoId, Number(articleId));

  return NextResponse.json({ clipPath: outputPath, filename });
}
