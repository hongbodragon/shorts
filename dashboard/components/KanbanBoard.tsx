"use client";
import { useEffect, useState, useCallback } from "react";
import { ExternalLink, Trash2, CheckCircle, RefreshCw } from "lucide-react";

const STAGES = [
  { key: "collected",  label: "기사 확인",     color: "bg-gray-100" },
  { key: "approved",   label: "반응 좋음",     color: "bg-green-100" },
  { key: "scripting",  label: "스크립트",      color: "bg-blue-100" },
  { key: "imaging",    label: "이미지/영상",    color: "bg-purple-100" },
  { key: "subtitling", label: "자막",          color: "bg-yellow-100" },
  { key: "preview",    label: "미리보기",      color: "bg-orange-100" },
  { key: "uploading",  label: "업로드 완료",   color: "bg-teal-100" },
  { key: "monitoring", label: "1시간 후 반응", color: "bg-pink-100" },
  { key: "done",       label: "결과 정리",     color: "bg-slate-100" },
  { key: "trash",      label: "🗑️ 휴지통",    color: "bg-red-50" },
];

type Article = {
  id: number;
  title: string;
  url: string;
  source: string;
  collected_at: string;
  stage: string;
  is_ab_test: number;
};

export default function KanbanBoard({ categoryId }: { categoryId: number }) {
  const [grouped, setGrouped] = useState<Record<string, Article[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/articles?categoryId=${categoryId}`);
    setGrouped(await res.json());
    setLoading(false);
  }, [categoryId]);

  useEffect(() => { load(); }, [load]);

  const moveStage = async (articleId: number, stage: string) => {
    await fetch("/api/articles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, stage }),
    });
    load();
  };

  if (loading) return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;

  const totalArticles = Object.values(grouped).flat().length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">전체 {totalArticles}건</span>
        <button onClick={load} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map(({ key, label, color }) => {
          const articles = grouped[key] ?? [];
          return (
            <div key={key} className={`flex-shrink-0 w-64 rounded-xl p-3 ${color}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-gray-700">{label}</h3>
                <span className="text-xs bg-white rounded-full px-2 py-0.5 font-mono text-gray-500">
                  {articles.length}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {articles.map((a) => (
                  <ArticleCard
                    key={a.id}
                    article={a}
                    currentStage={key}
                    onMove={moveStage}
                  />
                ))}
                {articles.length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-4">없음</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArticleCard({
  article,
  currentStage,
  onMove,
}: {
  article: Article;
  currentStage: string;
  onMove: (id: number, stage: string) => void;
}) {
  const stageKeys = STAGES.map((s) => s.key);
  const currentIdx = stageKeys.indexOf(currentStage);
  const nextStage = stageKeys[currentIdx + 1];
  const isTrash = currentStage === "trash";

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm text-xs group">
      <div className="flex items-start justify-between gap-1 mb-2">
        <p className="font-medium text-gray-800 leading-snug line-clamp-2">{article.title}</p>
        {article.is_ab_test === 1 && (
          <span className="flex-shrink-0 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">A/B</span>
        )}
      </div>

      <div className="flex items-center justify-between text-gray-400">
        <span>{article.source}</span>
        <span>{article.collected_at?.slice(5, 16)}</span>
      </div>

      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600"
        >
          <ExternalLink size={11} /> 원문
        </a>
        {!isTrash && nextStage && (
          <button
            onClick={() => onMove(article.id, nextStage)}
            className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-green-100 hover:bg-green-200 text-green-700"
          >
            <CheckCircle size={11} /> 승인
          </button>
        )}
        {currentStage === "collected" && (
          <button
            onClick={() => onMove(article.id, "trash")}
            className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-400"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
