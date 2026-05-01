"use client";
import { useEffect, useState } from "react";
import KanbanBoard from "@/components/KanbanBoard";

type Category = { id: number; name: string; slug: string };

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<number>(0);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: Category[]) => {
        setCategories(data);
        if (data.length > 0) setActiveCat(data[0].id);
      });
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">📹 Shorts 자동화</h1>
          <div className="flex gap-2">
            <a href="/settings/keys" className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded hover:bg-gray-100">API 키</a>
            <a href="/settings/channels" className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded hover:bg-gray-100">채널</a>
            <a href="/settings/ai" className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded hover:bg-gray-100">AI 설정</a>
          </div>
        </div>
        <div className="max-w-screen-2xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeCat === cat.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        {activeCat > 0 && <KanbanBoard categoryId={activeCat} />}
      </div>
    </main>
  );
}
