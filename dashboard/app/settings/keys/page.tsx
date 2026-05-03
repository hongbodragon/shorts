"use client";
import { useEffect, useState } from "react";
import { Trash2, ToggleLeft, ToggleRight, Plus, Eye, EyeOff, Pencil, Check, X } from "lucide-react";

// 서비스별 입력 필드 정의
const SERVICE_CONFIGS: Record<string, { label: string; fields: { key: string; label: string; placeholder: string; isExtra?: boolean }[] }> = {
  naver:      { label: "네이버", fields: [
    { key: "api_key", label: "Client ID",     placeholder: "예) kPCLqxg1a6VOnajGPvJb" },
    { key: "client_secret", label: "Client Secret", placeholder: "예) SG3mybMjD7", isExtra: true },
  ]},
  anthropic:  { label: "Anthropic (Claude)", fields: [
    { key: "api_key", label: "API Key", placeholder: "sk-ant-..." },
  ]},
  openai:     { label: "OpenAI (GPT / DALL-E)", fields: [
    { key: "api_key", label: "API Key", placeholder: "sk-..." },
  ]},
  google_ai:  { label: "Google AI (Gemini / Imagen / TTS)", fields: [
    { key: "api_key", label: "API Key", placeholder: "AIza..." },
  ]},
  aws_polly:  { label: "AWS Polly", fields: [
    { key: "api_key",       label: "Access Key ID",     placeholder: "AKIA..." },
    { key: "client_secret", label: "Secret Access Key", placeholder: "wJalrXUtnFEMI...", isExtra: true },
  ]},
  elevenlabs: { label: "ElevenLabs", fields: [
    { key: "api_key", label: "API Key", placeholder: "sk_..." },
  ]},
  typecast:   { label: "TYPECAST", fields: [
    { key: "api_key", label: "API Key", placeholder: "Bearer 토큰" },
    { key: "voice_id", label: "Voice ID", placeholder: "예) 6f8d9e...", isExtra: true },
  ]},
  pexels:     { label: "Pexels", fields: [
    { key: "api_key", label: "API Key", placeholder: "..." },
  ]},
  unsplash:   { label: "Unsplash", fields: [
    { key: "api_key",       label: "Access Key",  placeholder: "...", },
    { key: "client_secret", label: "Secret Key",  placeholder: "...", isExtra: true },
  ]},
  telegram:   { label: "Telegram Bot", fields: [
    { key: "api_key", label: "Bot Token", placeholder: "123456:ABC-DEF..." },
  ]},
  youtube_data: { label: "YouTube Data API", fields: [
    { key: "api_key", label: "API Key", placeholder: "AIza..." },
  ]},
};

const SERVICES = Object.keys(SERVICE_CONFIGS);

type ApiKey = {
  id: number;
  service_name: string;
  key_label: string;
  api_key: string;
  extra: string | null;
  is_active: number;
  last_used_at: string | null;
  error_count: number;
};

type EditState = {
  key_label: string;
  api_key: string;
  client_secret: string;
};

function maskKey(key: string) {
  if (!key || key.length < 8) return "••••••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}

function parseExtra(extra: string | null): Record<string, string> {
  try { return extra ? JSON.parse(extra) : {}; } catch { return {}; }
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [form, setForm] = useState<Record<string, string>>({ service_name: "naver", key_label: "", api_key: "", client_secret: "" });
  const [showFormKey, setShowFormKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ key_label: "", api_key: "", client_secret: "" });
  const [showEditKey, setShowEditKey] = useState(false);

  const load = () => fetch("/api/settings/keys").then((r) => r.json()).then(setKeys);
  useEffect(() => { load(); }, []);

  const grouped = SERVICES.reduce((acc, s) => {
    acc[s] = keys.filter((k) => k.service_name === s);
    return acc;
  }, {} as Record<string, ApiKey[]>);

  const selectedConfig = SERVICE_CONFIGS[form.service_name];
  const hasSecret = selectedConfig?.fields.some((f) => f.isExtra);

  const buildExtra = (serviceName: string, formData: Record<string, string>) => {
    const config = SERVICE_CONFIGS[serviceName];
    const extraFields = config?.fields.filter((f) => f.isExtra) ?? [];
    if (extraFields.length === 0) return undefined;
    const obj: Record<string, string> = {};
    for (const f of extraFields) {
      if (formData[f.key]) obj[f.key] = formData[f.key];
    }
    return Object.keys(obj).length > 0 ? JSON.stringify(obj) : undefined;
  };

  const add = async () => {
    if (!form.api_key.trim()) return;
    setSaving(true);
    const extra = buildExtra(form.service_name, form);
    await fetch("/api/settings/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_name: form.service_name, api_key: form.api_key, key_label: form.key_label, extra }),
    });
    const extraKeys = (SERVICE_CONFIGS[form.service_name]?.fields ?? []).filter(f => f.isExtra).map(f => f.key);
    setForm((f) => { const next: Record<string, string> = { ...f, api_key: "", key_label: "" }; extraKeys.forEach(k => { next[k] = ""; }); return next; });
    await load();
    setSaving(false);
  };

  const startEdit = (k: ApiKey) => {
    const extra = parseExtra(k.extra);
    const config = SERVICE_CONFIGS[k.service_name];
    const extraInit: Record<string, string> = {};
    config?.fields.filter(f => f.isExtra).forEach(f => { extraInit[f.key] = extra[f.key] ?? ""; });
    setEditId(k.id);
    setEditState({ key_label: k.key_label, api_key: k.api_key, ...extraInit } as EditState);
    setShowEditKey(false);
  };

  const saveEdit = async () => {
    if (editId === null) return;
    const k = keys.find((x) => x.id === editId)!;
    const extra = buildExtra(k.service_name, editState as unknown as Record<string, string>);
    await fetch("/api/settings/keys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editId, key_label: editState.key_label, api_key: editState.api_key, ...(extra !== undefined ? { extra } : {}) }),
    });
    setEditId(null);
    load();
  };

  const toggle = async (id: number, current: number) => {
    await fetch("/api/settings/keys", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_active: !current }) });
    load();
  };

  const del = async (id: number) => {
    if (!confirm("이 키를 삭제하시겠습니까?")) return;
    await fetch("/api/settings/keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">API 키 관리</h1>

      {/* 추가 폼 */}
      <div className="bg-white rounded-xl border p-5 mb-8">
        <h2 className="font-semibold text-gray-700 mb-4 text-sm">새 키 추가</h2>
        <div className="flex flex-wrap gap-3 mb-3">
          <select
            value={form.service_name}
            onChange={(e) => setForm({ service_name: e.target.value, key_label: "", api_key: "" })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {SERVICES.map((s) => <option key={s} value={s}>{SERVICE_CONFIGS[s].label}</option>)}
          </select>
          <input
            placeholder="레이블 (예: 내 계정, 회사 계정)"
            value={form.key_label}
            onChange={(e) => setForm((f) => ({ ...f, key_label: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-44"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          {selectedConfig?.fields.map((field) => (
            <div key={field.key} className="flex flex-1 min-w-48 border rounded-lg overflow-hidden">
              <div className="flex flex-col flex-1">
                <span className="text-[10px] text-gray-400 px-3 pt-1.5">{field.label}</span>
                <input
                  type={field.isExtra ? (showFormKey ? "text" : "password") : "text"}
                  placeholder={field.placeholder}
                  value={form[field.key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                  className="px-3 pb-2 text-sm outline-none bg-transparent"
                />
              </div>
              {field.isExtra && (
                <button onClick={() => setShowFormKey(!showFormKey)} className="px-3 text-gray-400 hover:text-gray-700">
                  {showFormKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
            </div>
          ))}
          <button
            onClick={add}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 self-end"
          >
            <Plus size={14} /> 추가
          </button>
        </div>
      </div>

      {/* 서비스별 키 목록 */}
      <div className="flex flex-col gap-6">
        {SERVICES.map((service) => {
          const config = SERVICE_CONFIGS[service];
          const serviceKeys = grouped[service] ?? [];
          const hasExtraField = config.fields.some((f) => f.isExtra);

          return (
            <div key={service} className="bg-white rounded-xl border overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
                <span className="font-semibold text-sm text-gray-700">{config.label}</span>
                <span className="text-xs text-gray-400 font-mono">{serviceKeys.length}개</span>
              </div>

              {serviceKeys.length === 0 ? (
                <div className="px-5 py-4 text-sm text-gray-400">등록된 키 없음</div>
              ) : (
                <div className="divide-y">
                  {serviceKeys.map((k) => {
                    const extra = parseExtra(k.extra);
                    const isEditing = editId === k.id;

                    return (
                      <div key={k.id} className={`px-5 py-4 ${!k.is_active ? "opacity-50" : ""}`}>
                        {isEditing ? (
                          /* 편집 모드 */
                          <div className="flex flex-col gap-3">
                            <div className="flex gap-2 flex-wrap">
                              <div className="flex flex-col border rounded-lg overflow-hidden min-w-32">
                                <span className="text-[10px] text-gray-400 px-3 pt-1.5">레이블</span>
                                <input
                                  value={editState.key_label}
                                  onChange={(e) => setEditState((s) => ({ ...s, key_label: e.target.value }))}
                                  className="px-3 pb-2 text-sm outline-none"
                                  placeholder="레이블"
                                />
                              </div>
                              {config.fields.map((field, fi) => (
                                <div key={field.key} className="flex flex-1 min-w-48 border rounded-lg overflow-hidden">
                                  <div className="flex flex-col flex-1">
                                    <span className="text-[10px] text-gray-400 px-3 pt-1.5">{field.label}</span>
                                    <input
                                      type={field.isExtra ? (showEditKey ? "text" : "password") : "text"}
                                      value={(editState as Record<string, string>)[field.key] ?? ""}
                                      onChange={(e) => setEditState((s) => ({ ...s, [field.key]: e.target.value }))}
                                      className="px-3 pb-2 text-sm outline-none"
                                      placeholder={field.placeholder}
                                    />
                                  </div>
                                  {field.isExtra && fi === config.fields.length - 1 && (
                                    <button onClick={() => setShowEditKey(!showEditKey)} className="px-3 text-gray-400 hover:text-gray-700">
                                      {showEditKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                                <Check size={13} /> 저장
                              </button>
                              <button onClick={() => setEditId(null)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                                <X size={13} /> 취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* 표시 모드 */
                          <div className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm text-gray-800">{k.key_label || <span className="text-gray-400 italic">레이블 없음</span>}</span>
                                {k.error_count > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">오류 {k.error_count}회</span>}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {config.fields.map((field) => (
                                  <div key={field.key} className="text-xs text-gray-500">
                                    <span className="text-gray-400">{field.label}: </span>
                                    <span className="font-mono">
                                      {field.isExtra ? maskKey(extra[field.key] ?? "") : maskKey(k.api_key)}
                                    </span>
                                  </div>
                                ))}
                                {k.last_used_at && (
                                  <div className="text-xs text-gray-400">최근 사용: {k.last_used_at.slice(5, 16)}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => startEdit(k)} className="text-gray-400 hover:text-gray-700">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => toggle(k.id, k.is_active)} className={k.is_active ? "text-green-500" : "text-gray-300"}>
                                {k.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                              </button>
                              <button onClick={() => del(k.id)} className="text-red-400 hover:text-red-600">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
