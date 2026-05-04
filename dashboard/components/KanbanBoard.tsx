"use client";
import { useEffect, useState, useCallback } from "react";
import { ExternalLink, Trash2, CheckCircle, RefreshCw, MessageCircle, Eye, Plus, Globe, Loader2 } from "lucide-react";
import ArticleModal from "./ArticleModal";

const STAGES = [
  { key: "collected",  label: "수집됨",         color: "bg-gray-100" },
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
  published_at: string;
  collected_at: string;
  view_cnt: number;
  comment_cnt: number;
  stage: string;
  is_ab_test: number;
};

const REGIONS = [
  { code: "US", label: "🇺🇸 미국" }, { code: "JP", label: "🇯🇵 일본" },
  { code: "GB", label: "🇬🇧 영국" }, { code: "FR", label: "🇫🇷 프랑스" },
  { code: "DE", label: "🇩🇪 독일" }, { code: "IN", label: "🇮🇳 인도" },
  { code: "AU", label: "🇦🇺 호주" }, { code: "CA", label: "🇨🇦 캐나다" },
  { code: "BR", label: "🇧🇷 브라질" },
];

type TrendingVideo = {
  videoId: string; title: string; thumbnail: string;
  channelTitle: string; viewCount: number; duration: number;
  description: string;
};

export default function KanbanBoard({ categoryId, categorySlug }: { categoryId: number; categorySlug?: string }) {
  const [grouped, setGrouped] = useState<Record<string, Article[]>>({});
  const [loading, setLoading] = useState(true);
  const [openArticleId, setOpenArticleId] = useState<number | null>(null);

  // 커뮤니티 URL 입력
  const [urlInput, setUrlInput] = useState("");
  const [urlAdding, setUrlAdding] = useState(false);
  const [urlError, setUrlError] = useState("");

  // 번안 급상승
  const [showTrending, setShowTrending] = useState(false);
  const [trendingRegion, setTrendingRegion] = useState("US");
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingVideos, setTrendingVideos] = useState<TrendingVideo[]>([]);
  const [trendingError, setTrendingError] = useState("");
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null);

  const isCommunity = categorySlug === "community";
  const isForeign = categorySlug === "foreign";

  const load = useCallback(async () => {
    setLoading(true);
    setGrouped({});
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

  const deleteArticle = async (articleId: number) => {
    if (!confirm("완전히 삭제합니다. 복구할 수 없습니다. 계속할까요?")) return;
    await fetch(`/api/articles/${articleId}`, { method: "DELETE" });
    load();
  };

  const addByUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlAdding(true);
    setUrlError("");
    try {
      const res = await fetch("/api/articles/create-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: urlInput.trim(), categoryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUrlInput("");
      load();
    } catch (e: unknown) {
      setUrlError(e instanceof Error ? e.message : "오류");
    } finally {
      setUrlAdding(false);
    }
  };

  const loadTrending = async () => {
    setTrendingLoading(true);
    setTrendingError("");
    setTrendingVideos([]);
    try {
      const res = await fetch(`/api/youtube/trending?regionCode=${trendingRegion}&maxResults=20`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTrendingVideos(data.items ?? []);
    } catch (e: unknown) {
      setTrendingError(e instanceof Error ? e.message : "오류");
    } finally {
      setTrendingLoading(false);
    }
  };

  const addTrendingVideo = async (video: TrendingVideo) => {
    setAddingVideoId(video.videoId);
    try {
      await fetch("/api/articles/parse-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${video.videoId}`,
          categoryId,
          articleType: "foreign",
          title: video.title,
          description: video.description,
          thumbnail: video.thumbnail,
          foreignVideoId: video.videoId,
        }),
      });
      load();
    } finally {
      setAddingVideoId(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;

  const totalArticles = Object.values(grouped).flat().length;

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div>
      {openArticleId && (
        <ArticleModal
          articleId={openArticleId}
          onClose={() => setOpenArticleId(null)}
          onStageChange={load}
        />
      )}

      {/* 커뮤니티: 주제 입력 */}
      {isCommunity && (
        <div className="mb-4 flex flex-col gap-1">
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setUrlError(""); }}
              onKeyDown={(e) => e.key === "Enter" && addByUrl()}
              placeholder="숏츠 주제/아이디어 입력 (예: 아프리카 초원에서 사자가 차를 뒤집는 영상)"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={addByUrl}
              disabled={urlAdding || !urlInput.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              {urlAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              추가
            </button>
          </div>
          {urlError && <p className="text-red-500 text-xs">{urlError}</p>}
        </div>
      )}

      {/* 번안/해외: 급상승 수집 */}
      {isForeign && (
        <div className="mb-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <select
              value={trendingRegion}
              onChange={(e) => setTrendingRegion(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
            <button
              onClick={() => { setShowTrending(true); loadTrending(); }}
              disabled={trendingLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              {trendingLoading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              해외 급상승 가져오기
            </button>
          </div>

          {trendingError && <p className="text-red-500 text-sm">{trendingError}</p>}

          {showTrending && trendingVideos.length > 0 && (
            <div className="border rounded-xl overflow-hidden bg-white">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
                <span className="text-sm font-semibold text-gray-700">
                  {REGIONS.find(r => r.code === trendingRegion)?.label} 급상승 {trendingVideos.length}개
                </span>
                <button onClick={() => setShowTrending(false)} className="text-xs text-gray-400 hover:text-gray-700">닫기</button>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y">
                {trendingVideos.map((v) => (
                  <div key={v.videoId} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
                    <img src={v.thumbnail} alt="" className="w-20 h-12 object-cover rounded flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 line-clamp-1">{v.title}</p>
                      <p className="text-[11px] text-gray-400">
                        {v.channelTitle} · 조회 {(v.viewCount / 10000).toFixed(0)}만 · {formatDuration(v.duration)}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <a
                        href={`https://youtube.com/watch?v=${v.videoId}`}
                        target="_blank" rel="noreferrer"
                        className="p-1.5 text-gray-400 hover:text-blue-600"
                      >
                        <ExternalLink size={13} />
                      </a>
                      <button
                        onClick={() => addTrendingVideo(v)}
                        disabled={addingVideoId === v.videoId}
                        className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded text-xs"
                      >
                        {addingVideoId === v.videoId ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                        추가
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                    onOpen={() => setOpenArticleId(a.id)}
                    onDelete={deleteArticle}
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
  onOpen,
  onDelete,
}: {
  article: Article;
  currentStage: string;
  onMove: (id: number, stage: string) => void;
  onOpen: () => void;
  onDelete: (id: number) => void;
}) {
  const stageKeys = STAGES.map((s) => s.key);
  const currentIdx = stageKeys.indexOf(currentStage);
  const nextStage = stageKeys[currentIdx + 1];
  const isTrash = currentStage === "trash";

  return (
    <div
      className="bg-white rounded-lg p-3 shadow-sm text-xs group cursor-pointer hover:shadow-md transition-shadow"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <p className="font-medium text-gray-800 leading-snug line-clamp-2">{article.title}</p>
        {article.is_ab_test === 1 && (
          <span className="flex-shrink-0 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">A/B</span>
        )}
      </div>

      <div className="flex items-center justify-between text-gray-400 mt-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-gray-400">{article.source}</span>
          {article.comment_cnt > 0 && (
            <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
              article.comment_cnt >= 5
                ? "bg-blue-500 text-white"
                : "bg-blue-100 text-blue-700"
            }`}>
              <MessageCircle size={8} />{article.comment_cnt}
            </span>
          )}
          {article.view_cnt > 0 && (
            <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
              article.view_cnt >= 1000
                ? "bg-orange-500 text-white"
                : "bg-orange-100 text-orange-600"
            }`}>
              <Eye size={8} />{article.view_cnt >= 1000 ? `${(article.view_cnt / 1000).toFixed(1)}k` : article.view_cnt}
            </span>
          )}
        </div>
        <span title={`수집: ${article.collected_at}`}>{(article.published_at || article.collected_at)?.slice(5, 16)}</span>
      </div>

      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
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
        {!isTrash && (
          <button
            onClick={() => onMove(article.id, "trash")}
            className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-400"
          >
            <Trash2 size={11} />
          </button>
        )}
        {isTrash && (
          <button
            onClick={() => onDelete(article.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-[11px] font-medium"
          >
            <Trash2 size={11} /> 완전 삭제
          </button>
        )}
      </div>
    </div>
  );
}
