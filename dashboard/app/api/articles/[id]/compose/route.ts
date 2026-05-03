import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 300;

import { getDb } from "@/lib/db";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ASS 타임코드: H:MM:SS.cc
function toAss(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

// 공백·쉼표·마침표·느낌표·물음표 기준으로 토큰 분리 후 ASS 강제 줄바꿈(\N)
function wrapText(text: string, maxChars = 13): string {
  const tokens = text.split(/(?<=[ ,!?])/u).map((t) => t.trim()).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const token of tokens) {
    if (!current) {
      current = token;
    } else if ((current + " " + token).length <= maxChars) {
      current += " " + token;
    } else {
      lines.push(current);
      current = token;
    }
  }
  if (current) lines.push(current);
  return lines.join("\\N"); // ASS 강제 줄바꿈
}

// ASS 자막 파일 생성 (PlayResX/Y로 실제 해상도 지정 → 정확한 폰트 크기 & 줄바꿈)
function buildAss(scriptLines: string[], totalDuration: number, fontSize = 110): string {
  const perLine = totalDuration / scriptLines.length;
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Malgun Gothic Bold,${fontSize},&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,6,3,2,40,40,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = scriptLines.map((line, i) => {
    const start = i * perLine;
    const end = Math.min((i + 1) * perLine, totalDuration);
    const text = wrapText(line);
    return `Dialogue: 0,${toAss(start)},${toAss(end)},Default,,0,0,0,,${text}`;
  });

  return header + "\n" + events.join("\n") + "\n";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const fontSize: number = body.fontSize ?? 110;

  const article = getDb()
    .prepare("SELECT * FROM articles WHERE id = ?")
    .get(Number(id)) as Record<string, string> | undefined;

  if (!article) return NextResponse.json({ error: "기사를 찾을 수 없습니다." }, { status: 404 });
  if (!article.script) return NextResponse.json({ error: "스크립트가 없습니다." }, { status: 400 });
  if (!article.tts_path) return NextResponse.json({ error: "음성 파일이 없습니다. 음성 탭에서 먼저 생성해주세요." }, { status: 400 });
  if (!article.image_paths) return NextResponse.json({ error: "이미지가 없습니다. 이미지 탭에서 먼저 생성해주세요." }, { status: 400 });

  let imagePaths: string[] = [];
  try { imagePaths = JSON.parse(article.image_paths); } catch { /* empty */ }
  if (imagePaths.length === 0) return NextResponse.json({ error: "이미지가 없습니다." }, { status: 400 });

  const dataDir = join(process.cwd(), "..", "data");
  const tmpDir = join(dataDir, "tmp");
  const videoDir = join(dataDir, "videos");
  await mkdir(tmpDir, { recursive: true });
  await mkdir(videoDir, { recursive: true });

  const tmpFiles: string[] = [];

  try {
    // 이미지 → 실제 파일 경로로 변환
    const resolvedImages: string[] = [];
    for (let i = 0; i < imagePaths.length; i++) {
      const src = imagePaths[i];
      const tmpPath = join(tmpDir, `img_${id}_${i}.jpg`);
      if (src.startsWith("data:")) {
        await writeFile(tmpPath, Buffer.from(src.split(",")[1], "base64"));
        tmpFiles.push(tmpPath);
        resolvedImages.push(tmpPath);
      } else if (src.startsWith("http")) {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`이미지 다운로드 실패: ${src}`);
        await writeFile(tmpPath, Buffer.from(await res.arrayBuffer()));
        tmpFiles.push(tmpPath);
        resolvedImages.push(tmpPath);
      } else {
        resolvedImages.push(src);
      }
    }

    // 오디오 길이 측정
    const audioPath = article.tts_path;
    const { stdout: durationOut, stderr: durationErr } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
      { maxBuffer: 1024 * 1024 }
    ).catch((e) => { throw new Error(`ffprobe 오류: ${e.message}`); });

    const totalDuration = parseFloat(durationOut.trim());
    if (!totalDuration || isNaN(totalDuration)) {
      throw new Error(`오디오 길이 측정 실패: "${durationOut}" / "${durationErr}"`);
    }

    // 이미지 슬라이드 concat 파일
    const perImage = totalDuration / resolvedImages.length;
    const concatLines: string[] = [];
    for (const p of resolvedImages) {
      concatLines.push(`file '${p.replace(/\\/g, "/")}'`);
      concatLines.push(`duration ${perImage.toFixed(3)}`);
    }
    concatLines.push(`file '${resolvedImages.at(-1)!.replace(/\\/g, "/")}'`);
    const concatFile = join(tmpDir, `concat_${id}.txt`);
    await writeFile(concatFile, concatLines.join("\n"));
    tmpFiles.push(concatFile);

    // ASS 자막 파일 생성
    const scriptLines = article.script
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("["));
    const assContent = buildAss(scriptLines, totalDuration, fontSize);
    const assFile = join(tmpDir, `sub_${id}.ass`);
    await writeFile(assFile, assContent, "utf8");
    tmpFiles.push(assFile);

    const outputPath = join(videoDir, `article_${id}_${Date.now()}.mp4`);

    // Windows 경로: 콜론 이스케이프
    const escPath = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:");

    const vfParts = [
      "scale=1080:1920:force_original_aspect_ratio=increase",
      "crop=1080:1920",
      "setsar=1",
      "fps=30",
      `ass='${escPath(assFile)}'`,
    ];

    const cmd = [
      "ffmpeg -y",
      `-f concat -safe 0 -i "${concatFile}"`,
      `-i "${audioPath}"`,
      `-vf "${vfParts.join(",")}"`,
      `-c:v libx264 -preset fast -crf 23`,
      `-c:a aac -b:a 128k`,
      `-shortest -movflags +faststart`,
      `"${outputPath}"`,
    ].join(" ");

    await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 300000 })
      .catch((e) => { throw new Error(`ffmpeg 오류: ${e.stderr ?? e.message}`); });

    getDb().prepare("UPDATE articles SET video_path = ? WHERE id = ?").run(outputPath, Number(id));

    const url = `/api/articles/${id}/compose/video?file=${encodeURIComponent(outputPath)}`;
    return NextResponse.json({ url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[compose]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    for (const f of tmpFiles) {
      await unlink(f).catch(() => null);
    }
  }
}
