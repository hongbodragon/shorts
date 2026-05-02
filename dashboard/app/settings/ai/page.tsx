"use client";
import { useEffect, useState } from "react";

const SCRIPT_PROVIDERS = ["claude", "openai", "gemini"];
const SCRIPT_MODELS: Record<string, string[]> = {
  claude: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
};

const IMAGE_PROVIDERS = ["openai", "gemini", "pexels", "unsplash"];
const IMAGE_MODELS: Record<string, string[]> = {
  openai:   ["dall-e-3", "dall-e-2"],
  gemini:   ["imagen-3.0-generate-002", "imagen-3.0-fast-generate-001"],
  pexels:   [],   // 모델 선택 없음 (사진 검색 API)
  unsplash: [],
};
const IMAGE_NOTES: Record<string, string> = {
  openai:   "DALL-E 3: 고품질, $0.04/장 | DALL-E 2: 저렴, $0.018/장",
  gemini:   "Imagen 3: 최신 고품질 | Fast: 속도 우선",
  pexels:   "저작권 무료 사진 검색 — 무료, API 키 탭에서 등록",
  unsplash:  "저작권 무료 사진 검색 — 무료, API 키 탭에서 등록",
};

const TTS_PROVIDERS = ["polly", "google", "typecast", "elevenlabs"];
const TTS_NOTES: Record<string, string> = {
  polly:      "AWS Polly Neural — 100만자/월 12개월 무료 (권장)",
  google:     "Google TTS Wavenet — 100만자/월 영구 무료",
  typecast:   "TYPECAST — 고자연스러운 한국어 TTS, 유료",
  elevenlabs: "ElevenLabs — 상업용 $5/월부터 (무료 플랜 약관 위반 ⚠️)",
};

type AiSettings = {
  id: number;
  script_provider: string;
  script_model: string;
  image_provider: string;
  image_model: string;
  tts_provider: string;
};

export default function AiPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [form, setForm] = useState({
    script_provider: "claude",
    script_model: "claude-sonnet-4-6",
    image_provider: "pexels",
    image_model: "",
    tts_provider: "polly",
  });
  const [saved, setSaved] = useState(false);

  const load = () =>
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setSettings(data);
          setForm({
            script_provider: data.script_provider,
            script_model: data.script_model,
            image_provider: data.image_provider,
            image_model: data.image_model ?? IMAGE_MODELS[data.image_provider]?.[0] ?? "",
            tts_provider: data.tts_provider,
          });
        }
      });

  useEffect(() => { load(); }, []);

  const save = async () => {
    await fetch("/api/settings/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  };

  const setScriptProvider = (provider: string) => {
    const models = SCRIPT_MODELS[provider] ?? [];
    setForm((f) => ({ ...f, script_provider: provider, script_model: models[0] ?? "" }));
  };

  const setImageProvider = (provider: string) => {
    const models = IMAGE_MODELS[provider] ?? [];
    setForm((f) => ({ ...f, image_provider: provider, image_model: models[0] ?? "" }));
  };

  const imageModels = IMAGE_MODELS[form.image_provider] ?? [];

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">AI 설정</h1>

      <div className="bg-white rounded-xl border divide-y">
        {/* 스크립트 */}
        <div className="p-5">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">스크립트 생성</h2>
          <div className="flex gap-2 mb-3">
            {SCRIPT_PROVIDERS.map((p) => (
              <button key={p} onClick={() => setScriptProvider(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.script_provider === p ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                {p}
              </button>
            ))}
          </div>
          <select value={form.script_model} onChange={(e) => setForm((f) => ({ ...f, script_model: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-full">
            {(SCRIPT_MODELS[form.script_provider] ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* 이미지 */}
        <div className="p-5">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">이미지 생성</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {IMAGE_PROVIDERS.map((p) => (
              <button key={p} onClick={() => setImageProvider(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.image_provider === p ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                {p}
              </button>
            ))}
          </div>
          {imageModels.length > 0 && (
            <select value={form.image_model} onChange={(e) => setForm((f) => ({ ...f, image_model: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm w-full mb-2">
              {imageModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <p className="text-xs text-gray-400">{IMAGE_NOTES[form.image_provider]}</p>
        </div>

        {/* TTS */}
        <div className="p-5">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">TTS (음성 합성)</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {TTS_PROVIDERS.map((p) => (
              <button key={p} onClick={() => setForm((f) => ({ ...f, tts_provider: p }))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.tts_provider === p ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                {p}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">{TTS_NOTES[form.tts_provider]}</p>
        </div>

        {/* 저장 */}
        <div className="p-5">
          <button onClick={save}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
            {saved ? "저장됨 ✓" : "저장"}
          </button>
          {settings && (
            <p className="text-xs text-gray-400 mt-2">
              현재: {settings.script_provider}/{settings.script_model} · {settings.image_provider}{settings.image_model ? `/${settings.image_model}` : ""} · {settings.tts_provider}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
