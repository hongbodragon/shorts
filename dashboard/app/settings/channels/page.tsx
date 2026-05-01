"use client";
import { useEffect, useState } from "react";
import { Plus, ToggleLeft, ToggleRight } from "lucide-react";

type Channel = {
  id: number;
  name: string;
  description: string;
  youtube_channel_id: string;
  country_code: string;
  language: string;
  is_active: number;
  created_at: string;
};

const LANGUAGES = ["ko", "en", "ja", "zh", "pl", "de", "fr"];
const COUNTRIES = ["KR", "US", "JP", "CN", "PL", "AU", "GB", "CA", "DE", "FR"];

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [form, setForm] = useState({ name: "", description: "", youtube_channel_id: "", country_code: "KR", language: "ko" });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => fetch("/api/settings/channels").then((r) => r.json()).then(setChannels);
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name || !form.youtube_channel_id) return;
    setSaving(true);
    await fetch("/api/settings/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ name: "", description: "", youtube_channel_id: "", country_code: "KR", language: "ko" });
    setShowForm(false);
    await load();
    setSaving(false);
  };

  const toggle = async (id: number, current: number) => {
    await fetch("/api/settings/channels", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_active: !current }) });
    load();
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">유튜브 채널 관리</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus size={14} /> 채널 추가
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm">새 채널</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">채널명 *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-full" placeholder="예: 한국 방산 채널" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">유튜브 채널 ID *</label>
              <input value={form.youtube_channel_id} onChange={(e) => setForm((f) => ({ ...f, youtube_channel_id: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-full" placeholder="UCxxxxxxxx" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">설명</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-full" placeholder="채널 설명" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">국가</label>
              <select value={form.country_code} onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-full">
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">언어</label>
              <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-full">
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={add} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">저장</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">취소</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {channels.length === 0 && <div className="text-sm text-gray-400 py-8 text-center">등록된 채널이 없습니다</div>}
        {channels.map((ch) => (
          <div key={ch.id} className={`bg-white rounded-xl border p-5 flex items-center gap-4 ${!ch.is_active ? "opacity-50" : ""}`}>
            <div className="flex-1">
              <div className="font-semibold text-gray-800">{ch.name}</div>
              <div className="text-xs text-gray-400 mt-0.5 font-mono">{ch.youtube_channel_id} · {ch.country_code} · {ch.language}</div>
              {ch.description && <div className="text-sm text-gray-500 mt-1">{ch.description}</div>}
            </div>
            <button onClick={() => toggle(ch.id, ch.is_active)} className={ch.is_active ? "text-green-500" : "text-gray-300"}>
              {ch.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
