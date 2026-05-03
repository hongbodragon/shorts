import { NextRequest, NextResponse } from "next/server";
import { getDb, getApiKeys, getAiSettings } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { requirements } = await req.json();

  const db = getDb();
  const article = db.prepare("SELECT * FROM articles WHERE id = ?").get(Number(id)) as Record<string, string> | undefined;
  if (!article) return NextResponse.json({ error: "not found" }, { status: 404 });

  const settings = getAiSettings() as Record<string, string> | undefined;
  const provider = settings?.script_provider ?? "anthropic";
  const model = settings?.script_model ?? "claude-sonnet-4-6";

  const prompt = buildPrompt(article, requirements);

  try {
    const raw = await callAI(provider, model, prompt);
    const { title, script } = parseOutput(raw);

    db.prepare("UPDATE articles SET script = ?, shorts_title = ?, script_requirements = ? WHERE id = ?")
      .run(script, title, requirements ?? null, Number(id));

    return NextResponse.json({ script, title });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function parseOutput(raw: string): { title: string; script: string } {
  // [제목] 다음 줄 ~ 다음 [태그] 전까지 추출
  const lines = raw.split("\n");
  let title = "";
  let inTitle = false;
  const scriptLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "[제목]") { inTitle = true; continue; }
    if (inTitle && line.trim().startsWith("[")) { inTitle = false; }
    if (inTitle) { title = line.trim(); inTitle = false; continue; }
    if (line.trim() !== "[제목]") scriptLines.push(line);
  }

  const script = scriptLines.join("\n").trim();
  return { title, script };
}

function buildPrompt(article: Record<string, string>, requirements?: string) {
  return `당신은 유튜브 쇼츠 전문 스크립트 작가입니다. 한국 40~60대 남성 타겟, 방산/군사/시사 채널입니다.

아래 기사/게시글을 바탕으로 정확히 60초짜리 숏츠 스크립트를 작성해주세요.

**분량 기준 (반드시 지킬 것):**
- 한국어 TTS 낭독 속도: 초당 약 5~6자
- 60초 = 발화 텍스트 기준 **300~360자** (공백·줄바꿈·[태그] 제외)
- 현재 분량이 짧으면 배경 설명, 맥락, 의미를 더 풀어서 채울 것
- 줄 수 기준: 최소 12줄 이상

**구조 및 규칙:**
- [훅] 2~3줄 (5초): 숫자·반전·의문으로 시청자를 붙잡는 첫 문장
- [본문] 8~10줄 (40초): 사건 배경 → 구체적 수치/사실 → 의미와 맥락 → 왜 중요한지
- [마무리] 2~3줄 (15초): 자부심/공감 유발 한 문장 + 댓글 유도
- 각 줄은 자막 1개 = 15~20자 이내 짧은 문장
- **쉼표(,)와 마침표(.) 사용 금지** — 대신 줄바꿈으로 끊을 것
- 느낌표(!)와 물음표(?)는 허용
- 톤: 스포츠 중계처럼 템포 있게, 국뽕 감성이지만 사실 기반
- 내용이 부족하면 같은 사건의 배경·맥락·의의를 더 구체적으로 서술

**제목 작성 규칙:**
- 원문 제목을 그대로 쓰지 말 것
- 훅의 핵심 문장을 기반으로, 궁금증·숫자·반전이 담긴 제목
- 25자 이내, 해시태그 없이

**출력 형식 (태그 포함, 이 형식 그대로, [제목]이 가장 먼저):**
[제목]
(유튜브 숏츠 제목 한 줄)

[훅]
(2~3줄)

[본문]
(8~10줄, 각 줄은 자막 한 개)

[마무리]
(2~3줄)

---
제목: ${article.title}
출처: ${article.source}
내용: ${article.description || article.title}
${requirements ? `\n추가 요구사항: ${requirements}` : ""}`;
}

async function callAI(provider: string, model: string, prompt: string): Promise<string> {
  if (provider === "anthropic") {
    return callAnthropic(model, prompt);
  } else if (provider === "openai") {
    return callOpenAI(model, prompt);
  } else if (provider === "gemini") {
    return callGemini(model, prompt);
  }
  throw new Error(`지원하지 않는 AI 프로바이더: ${provider}`);
}

async function callAnthropic(model: string, prompt: string): Promise<string> {
  const keys = getApiKeys("anthropic") as Array<{ api_key: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active) throw new Error("Anthropic API 키가 없습니다. 설정 > API 키에서 등록해주세요.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": active.api_key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API 오류: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text;
}

async function callOpenAI(model: string, prompt: string): Promise<string> {
  const keys = getApiKeys("openai") as Array<{ api_key: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active) throw new Error("OpenAI API 키가 없습니다. 설정 > API 키에서 등록해주세요.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${active.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API 오류: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callGemini(model: string, prompt: string): Promise<string> {
  const keys = getApiKeys("google_ai") as Array<{ api_key: string; is_active: number }>;
  const active = keys.find((k) => k.is_active);
  if (!active) throw new Error("Google AI API 키가 없습니다. 설정 > API 키에서 등록해주세요.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${active.api_key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API 오류: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}
