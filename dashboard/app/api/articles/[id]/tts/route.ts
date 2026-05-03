import { NextRequest, NextResponse } from "next/server";
import { getDb, getApiKeys, getAiSettings } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { script } = await req.json();

  if (!script) return NextResponse.json({ error: "스크립트가 없습니다." }, { status: 400 });

  // 태그([훅], [본문] 등) 제거한 낭독 텍스트
  const spokenText = (script as string)
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("["))
    .join(" ");

  const settings = getAiSettings() as Record<string, string> | undefined;
  const provider = settings?.tts_provider ?? "polly";

  try {
    const audioBuffer = await generateTts(provider, spokenText);

    // data/ 폴더에 저장
    const dir = join(process.cwd(), "..", "data", "audio");
    await mkdir(dir, { recursive: true });
    const filename = `article_${id}_${Date.now()}.mp3`;
    const filepath = join(dir, filename);
    await writeFile(filepath, audioBuffer);

    // DB에 경로 저장
    getDb().prepare("UPDATE articles SET tts_path = ? WHERE id = ?").run(filepath, Number(id));

    // 클라이언트에 스트리밍 URL 대신 API 경로 반환
    const url = `/api/articles/${id}/tts/audio?file=${encodeURIComponent(filename)}`;
    return NextResponse.json({ url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDb().prepare("SELECT tts_path FROM articles WHERE id = ?").get(Number(id)) as { tts_path: string } | undefined;
  if (!row?.tts_path) return NextResponse.json({ error: "없음" }, { status: 404 });

  const { readFile } = await import("fs/promises");
  try {
    const buf = await readFile(row.tts_path);
    return new NextResponse(buf, {
      headers: { "Content-Type": "audio/mpeg", "Content-Disposition": "inline" },
    });
  } catch {
    return NextResponse.json({ error: "파일 없음" }, { status: 404 });
  }
}

async function generateTts(provider: string, text: string): Promise<Buffer> {
  if (provider === "polly") return generatePolly(text);
  if (provider === "google") return generateGoogleTts(text);
  if (provider === "openai") return generateOpenAiTts(text);
  if (provider === "elevenlabs") return generateElevenLabs(text);
  if (provider === "typecast") return generateTypecast(text);
  throw new Error(`지원하지 않는 TTS 프로바이더: ${provider}. 설정 > AI 설정에서 변경해주세요.`);
}

async function generatePolly(text: string): Promise<Buffer> {
  const keys = getApiKeys("aws") as Array<{ api_key: string; extra: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active) throw new Error("AWS API 키가 없습니다. 설정 > API 키에서 등록해주세요.");

  const extra = (() => { try { return JSON.parse(active.extra ?? "{}"); } catch { return {}; } })();
  const region = extra.region ?? "ap-northeast-2";

  // AWS Polly — SigV4 서명 없이 직접 호출하려면 SDK 필요
  // polly SDK 없이 fetch로 호출하면 SigV4가 복잡하므로 OpenAI TTS로 안내
  throw new Error(
    "AWS Polly는 SDK 설치가 필요합니다. 설정 > AI 설정에서 TTS를 'openai'로 변경 후 사용해주세요. (pip install boto3 또는 npm install @aws-sdk/client-polly)"
  );
  void region;
}

async function generateGoogleTts(text: string): Promise<Buffer> {
  const keys = getApiKeys("google_ai") as Array<{ api_key: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active) throw new Error("Google AI API 키가 없습니다. 설정 > API 키에서 등록해주세요.");

  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${active.api_key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "ko-KR", name: "ko-KR-Wavenet-C", ssmlGender: "MALE" },
        audioConfig: { audioEncoding: "MP3", speakingRate: 1.1, pitch: -1 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Google TTS API 오류: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Buffer.from(data.audioContent, "base64");
}

async function generateOpenAiTts(text: string): Promise<Buffer> {
  const keys = getApiKeys("openai") as Array<{ api_key: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active) throw new Error("OpenAI API 키가 없습니다. 설정 > API 키에서 등록해주세요.");

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${active.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: "onyx", // 저음 남성 — 방산/시사 채널 적합
      speed: 1.1,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS API 오류: ${res.status} ${await res.text()}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

async function generateElevenLabs(text: string): Promise<Buffer> {
  const keys = getApiKeys("elevenlabs") as Array<{ api_key: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active) throw new Error("ElevenLabs API 키가 없습니다. 설정 > API 키에서 등록해주세요.");

  const voiceId = "pNInz6obpgDQGcFmaJgB"; // Adam (남성)
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": active.api_key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs API 오류: ${res.status} ${await res.text()}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

async function generateTypecast(text: string): Promise<Buffer> {
  const keys = getApiKeys("typecast") as Array<{ api_key: string; extra: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active) throw new Error("TYPECAST API 키가 없습니다. 설정 > API 키에서 등록해주세요.");

  // extra 필드에 voice_id 저장 — 없으면 기본 남성 목소리
  const extra = (() => { try { return JSON.parse(active.extra ?? "{}"); } catch { return {}; } })();
  const voiceId = extra.voice_id ?? "tc_60e5426de8b95f1d3000d7b5";

  const res = await fetch("https://api.typecast.ai/v1/text-to-speech", {
    method: "POST",
    headers: {
      "X-API-KEY": active.api_key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voice_id: voiceId,
      text,
      model: "ssfm-v30",
      language: "ko",
      emotion: "normal",
      output_format: "mp3",
      tempo: 1.1,
    }),
  });
  if (!res.ok) throw new Error(`TYPECAST API 오류: ${res.status} ${await res.text()}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}
