import { NextRequest, NextResponse } from "next/server";
import { getApiKeys, getAiSettings } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const { index, prompt, previousPrompts, title } = await req.json();

  const settings = getAiSettings() as Record<string, string> | undefined;
  const provider = settings?.image_provider ?? "openai";
  const model = settings?.image_model ?? "";
  const scenePrompt = (prompt as string)?.trim() || (title as string) || "한국 방산 뉴스 장면";
  const prevPrompts = (previousPrompts as string[] | undefined) ?? [];

  try {
    const url = await generateImage(provider, model, scenePrompt, prevPrompts, index as number);
    return NextResponse.json({ url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function generateImage(provider: string, model: string, scenePrompt: string, prevPrompts: string[], index: number): Promise<string> {
  if (provider === "openai") return generateDallE(model || "gpt-image-1-mini", scenePrompt, prevPrompts, index);
  if (provider === "gemini") return generateGemini(model || "imagen-4.0-generate-001", scenePrompt, prevPrompts, index);
  throw new Error(`지원하지 않는 이미지 프로바이더: ${provider}`);
}

function buildImageGenPrompt(sceneText: string, prevPrompts: string[], index: number): string {
  const styleGuide =
    "Cinematic vertical 9:16 composition. Korean military/defense news visual. " +
    "Dramatic lighting, realistic photo style, no text or watermarks. ";

  const context = prevPrompts.length > 0
    ? `Previous scenes for continuity reference: ${prevPrompts.map((p, i) => `Scene ${i + 1}: ${p}`).join(" | ")}. `
    : "";

  return styleGuide + context + `Scene ${index + 1} (THIS scene to generate): ` + sceneText;
}

async function generateDallE(model: string, scenePrompt: string, prevPrompts: string[], index: number): Promise<string> {
  const keys = getApiKeys("openai") as Array<{ api_key: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active) throw new Error("OpenAI API 키가 없습니다. 설정 > API 키에서 등록해주세요.");

  const isGptImage = model.startsWith("gpt-image") || model === "chatgpt-image-latest";
  // dall-e-2는 세로형 미지원, gpt-image 계열은 1024x1536(3:2 세로) 지원
  const size = model === "dall-e-2" ? "1024x1024" : isGptImage ? "1024x1536" : "1024x1792";

  const body: Record<string, unknown> = {
    model,
    prompt: buildImageGenPrompt(scenePrompt, prevPrompts, index),
    n: 1,
    size,
  };

  if (isGptImage) {
    body.quality = "medium"; // low / medium / high
    // gpt-image 계열은 response_format 파라미터 없음 → b64_json으로 반환됨
  } else {
    body.quality = "standard";
    body.response_format = "url";
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${active.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`OpenAI 이미지 API 오류: ${res.status} ${await res.text()}`);
  const data = await res.json();

  if (isGptImage) {
    const b64 = data.data?.[0]?.b64_json as string;
    if (!b64) throw new Error("이미지 응답이 없습니다.");
    return `data:image/png;base64,${b64}`;
  }
  return data.data[0].url as string;
}

async function generateGemini(model: string, scenePrompt: string, prevPrompts: string[], index: number): Promise<string> {
  const keys = getApiKeys("google_ai") as Array<{ api_key: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active) throw new Error("Google AI API 키가 없습니다. 설정 > API 키에서 등록해주세요.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${active.api_key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: buildImageGenPrompt(scenePrompt, prevPrompts, index) }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "9:16",
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini Imagen API 오류: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const b64 = data.predictions?.[0]?.bytesBase64Encoded as string;
  if (!b64) throw new Error("Gemini Imagen 응답에 이미지가 없습니다.");
  return `data:image/png;base64,${b64}`;
}
