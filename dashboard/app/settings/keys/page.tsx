"use client";
import { useEffect, useState } from "react";
import { Trash2, ToggleLeft, ToggleRight, Plus, Eye, EyeOff } from "lucide-react";

const SERVICES = [
  "naver", "anthropic", "openai", "google_ai", "aws_polly",
  "elevenlabs", "typecast", "pexels", "unsplash", "telegram",
];

type ApiKey = {
  id: number;
  service_name: string;
  key_label: string;
  is_active: number;
  last_used_at: string | null;
  error_count: number;
};

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [form, setForm] = useState({ service_name: "naver", api_key: "", key_label: "" });
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/settings/keys").then((r) => r.json()).then(setKeys);
  useEffect(() => { load(); }, []);

  const grouped = SERVICES.reduce((acc, s) => {
    acc[s] = keys.filter((k) => k.service_name === s);
    return acc;
  }, {} as Record<string, ApiKey[]>);

  const add = async () => {
    if (!form.api_key.trim()) return;
    setSaving(true);
    await fetch("/api/settings/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm((f) => ({ ...f, api_key: "", key_label: "" }));
    await load();
    setSaving(false);
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

      <div className="bg-white rounded-xl border p-5 mb-8">
        <h2 className="font-semibold text-gray-700 mb-4 text-sm">새 키 추가</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={form.service_name}
            onChange={(e) => setForm((f) => ({ ...f, service_name: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm flex-shrink-0"
          >
            {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            placeholder="레이블 (예: 계정1)"
            value={form.key_label}
            onChange={(e) => setForm((f) => ({ ...f, key_label: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-32"
          />
          <div className="flex flex-1 min-w-48 border rounded-lg overflow-hidden">
            <input
              type={showKey ? "text" : "password"}
              placeholder="API 키"
              value={form.api_key}
              onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
              className="flex-1 px-3 py-2 text-sm outline-none"
            />
            <button onClick={() => setShowKey(!showKey)} className="px-3 text-gray-400 hover:text-gray-700">
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button
            onClick={add}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} /> 추가
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {SERVICES.map((service) => (
          <div key={service} className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
              <span className="font-mono font-semibold text-sm text-gray-700">{service}</span>
              <span className="text-xs text-gray-400">{grouped[service].length}개</span>
            </div>
            {grouped[service].length === 0 ? (
              <div className="px-5 py-4 text-sm text-gray-400">등록된 키 없음</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {grouped[service].map((k) => (
                    <tr key={k.id} className="border-t first:border-0">
                      <td className="px-5 py-3 font-medium text-gray-700 w-32">{k.key_label || "—"}</td>
                      <td className="py-3 text-gray-400 font-mono text-xs">
                        {k.error_count > 0 && (
                          <span className="mr-2 text-red-500">오류 {k.error_count}회</span>
                        )}
                        {k.last_used_at ? `최근 사용: ${k.last_used_at.slice(5, 16)}` : "미사용"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => toggle(k.id, k.is_active)} className={k.is_active ? "text-green-500" : "text-gray-300"}>
                            {k.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                          </button>
                          <button onClick={() => del(k.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
