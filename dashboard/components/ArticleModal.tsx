"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  X, ExternalLink, Wand2, RefreshCw, Play, Pause, Download,
  Image as ImageIcon, Mic, FileText, Eye, CheckCircle, ChevronRight,
  MessageCircle, Loader2, AlignLeft, Maximize2
} from "lucide-react";

type YoutubeStats = {
  views: number;
  likes: number;
  comments: number;
  checked_at: string;
};

type ArticleDetail = {
  id: number;
  title: string;
  url: string;
  source: string;
  published_at: string;
  collected_at: string;
  description: string;
  view_cnt: number;
  comment_cnt: number;
  stage: string | null;
  shorts_title: string | null;
  script: string | null;
  script_requirements: string | null;
  tts_path: string | null;
  image_paths: string | null;
  impact_subtitles: string | null;
  youtube_video_id: string | null;
  youtube_stats: string | null; // JSON string
};

const STAGE_LABELS: Record<string, string> = {
  collected: "수집됨", approved: "반응 좋음", scripting: "스크립트",
  imaging: "이미지/영상", subtitling: "자막", preview: "미리보기",
  uploading: "업로드 완료", monitoring: "1시간 후 반응", done: "결과 정리", trash: "휴지통",
};

const TABS = [
  { key: "info",     label: "원문",   icon: FileText },
  { key: "script",   label: "스크립트", icon: AlignLeft },
  { key: "images",   label: "이미지",  icon: ImageIcon },
  { key: "tts",      label: "음성",   icon: Mic },
  { key: "subtitle", label: "자막",   icon: AlignLeft },
  { key: "preview",  label: "미리보기", icon: Eye },
];

export default function ArticleModal({
  articleId,
  onClose,
  onStageChange,
}: {
  articleId: number;
  onClose: () => void;
  onStageChange?: () => void;
}) {
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [tab, setTab] = useState("info");
  const overlayRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/articles/${articleId}`);
    setArticle(await res.json());
  }, [articleId]);

  useEffect(() => { load(); }, [load]);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const save = async (fields: Partial<ArticleDetail>) => {
    await fetch(`/api/articles/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    load();
  };

  const moveStage = async (stage: string) => {
    await fetch("/api/articles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, stage }),
    });
    load();
    onStageChange?.();
  };

  if (!article) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <Loader2 className="animate-spin text-white" size={32} />
      </div>
    );
  }

  const stage = article.stage ?? "collected";
  const stageKeys = Object.keys(STAGE_LABELS);
  const stageIdx = stageKeys.indexOf(stage);
  const nextStage = stageKeys[stageIdx + 1];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/50 flex justify-end"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl animate-slide-in">
        {/* 헤더 */}
        <div className="flex items-start gap-3 p-5 border-b">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                {article.source}
              </span>
              <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                {STAGE_LABELS[stage]}
              </span>
              {article.comment_cnt > 0 && (
                <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                  article.comment_cnt >= 5 ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700"
                }`}>
                  <MessageCircle size={9} />{article.comment_cnt}
                </span>
              )}
              {article.view_cnt > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                  article.view_cnt >= 1000 ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-600"
                }`}>
                  {article.view_cnt >= 1000 ? `${(article.view_cnt / 1000).toFixed(1)}k` : article.view_cnt}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-gray-900 leading-snug">{article.title}</h2>
            <p className="text-xs text-gray-400 mt-1">{article.published_at?.slice(0, 10)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 mt-0.5">
            <X size={20} />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {tab === "info"     && <InfoTab article={article} />}
          {tab === "script"   && <ScriptTab article={article} onSave={save} />}
          {tab === "images"   && <ImagesTab article={article} onSave={save} />}
          {tab === "tts"      && <TtsTab article={article} onSave={save} />}
          {tab === "subtitle" && <SubtitleTab article={article} />}
          {tab === "preview"  && <PreviewTab article={article} />}
        </div>

        {/* 하단: 스테이지 이동 */}
        <div className="border-t p-4 flex items-center gap-2">
          {nextStage && nextStage !== "trash" && (
            <button
              onClick={() => moveStage(nextStage)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
            >
              <CheckCircle size={14} />
              {STAGE_LABELS[nextStage]}으로 이동
              <ChevronRight size={14} />
            </button>
          )}
          {stage === "done" && (
            <button
              onClick={() => moveStage("done")}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold"
            >
              <CheckCircle size={14} /> 결과 정리 완료
            </button>
          )}
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <ExternalLink size={13} /> 원문 보기
          </a>
          <button
            onClick={() => moveStage("trash")}
            className="ml-auto px-3 py-2 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
          >
            휴지통
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────── 원문 탭 ────────────── */
function InfoTab({ article }: { article: ArticleDetail }) {
  return (
    <div className="p-5 space-y-4">
      <div>
        <Label>제목</Label>
        <p className="text-gray-800 font-medium">{article.title}</p>
      </div>

      {article.description && (
        <div>
          <Label>내용 요약</Label>
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
            {article.description}
          </p>
        </div>
      )}

      <div>
        <Label>원문 링크</Label>
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-blue-600 hover:underline text-sm break-all"
        >
          <ExternalLink size={12} />{article.url}
        </a>
      </div>

      <YouTubeEmbed url={article.url} />

      <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
        <div><span className="font-medium text-gray-700">출처</span><br />{article.source}</div>
        <div><span className="font-medium text-gray-700">게시일</span><br />{article.published_at?.slice(0, 10)}</div>
        <div><span className="font-medium text-gray-700">수집일</span><br />{article.collected_at?.slice(0, 16)}</div>
        {article.view_cnt > 0 && <div><span className="font-medium text-gray-700">조회수</span><br />{article.view_cnt.toLocaleString()}</div>}
        {article.comment_cnt > 0 && <div><span className="font-medium text-gray-700">댓글수</span><br />{article.comment_cnt}</div>}
      </div>
    </div>
  );
}

/* ────────────── 스크립트 탭 ────────────── */
function ScriptTab({
  article,
  onSave,
}: {
  article: ArticleDetail;
  onSave: (fields: Partial<ArticleDetail>) => Promise<void>;
}) {
  const [shortsTitle, setShortsTitle] = useState(article.shorts_title ?? article.title);
  const [script, setScript] = useState(article.script ?? "");
  const [requirements, setRequirements] = useState(article.script_requirements ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      await onSave({ shorts_title: shortsTitle, script_requirements: requirements });
      const res = await fetch(`/api/articles/${article.id}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirements }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScript(data.script);
      if (data.title) setShortsTitle(data.title);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "생성 오류");
    } finally {
      setLoading(false);
    }
  };

  const saveScript = () => onSave({ shorts_title: shortsTitle, script, script_requirements: requirements });

  return (
    <div className="p-5 space-y-4">
      <div>
        <Label>숏츠 제목 <span className="text-gray-400 font-normal">(클릭 후 편집)</span></Label>
        <input
          value={shortsTitle}
          onChange={(e) => setShortsTitle(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="유튜브에 표시될 제목"
        />
      </div>

      <div>
        <Label>추가 요구사항 <span className="text-gray-400 font-normal">(선택)</span></Label>
        <textarea
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          placeholder="예) 더 자극적인 훅으로, 마지막에 다음 영상 예고 추가, 전문 용어 줄이기..."
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {script ? "재생성" : "스크립트 생성"}
        </button>
        {script && (
          <button
            onClick={saveScript}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <CheckCircle size={14} /> 저장
          </button>
        )}
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

      {script && (
        <div>
          <Label>스크립트 <span className="text-gray-400 font-normal">(직접 편집 가능)</span></Label>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={16}
            className="w-full border rounded-lg px-3 py-2 text-sm text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-mono"
          />
          {(() => {
            // [태그], 공백, 줄바꿈 제외한 실제 발화 글자수
            const spoken = script.replace(/\[.*?\]/g, "").replace(/\s/g, "").length;
            const secs = Math.round(spoken / 5.5);
            const color = secs < 45 ? "text-red-500" : secs > 70 ? "text-amber-500" : "text-green-600";
            return (
              <p className={`text-xs mt-1 font-medium ${color}`}>
                약 {secs}초 분량 (발화 {spoken}자) {secs < 45 ? "— 너무 짧음, 재생성 권장" : secs > 70 ? "— 약간 김" : "— 적정"}
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ────────────── 이미지 탭 ────────────── */
const IMAGE_COUNT = 6;

// 스크립트 섹션별로 이미지 프롬프트 생성
function buildImagePrompts(script: string, articleTitle: string): string[] {
  const lines = script.split("\n").filter((l) => l.trim() && !l.startsWith("["));
  const total = IMAGE_COUNT;
  const perSlot = Math.ceil(lines.length / total);
  const prompts: string[] = [];
  for (let i = 0; i < total; i++) {
    const chunk = lines.slice(i * perSlot, (i + 1) * perSlot).join(" ").trim();
    prompts.push(chunk || articleTitle);
  }
  return prompts;
}

function ImagesTab({
  article,
  onSave,
}: {
  article: ArticleDetail;
  onSave: (fields: Partial<ArticleDetail>) => Promise<void>;
}) {
  const saved: string[] = (() => {
    try { return article.image_paths ? JSON.parse(article.image_paths) : []; } catch { return []; }
  })();
  const [images, setImages] = useState<string[]>(saved);
  const [generating, setGenerating] = useState<number | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [error, setError] = useState("");
  const [prompts, setPrompts] = useState<string[]>(() =>
    buildImagePrompts(article.script ?? "", article.title)
  );

  // 스크립트 변경 시 프롬프트 재계산 (이미 수정했으면 유지)
  const scriptRef = useRef(article.script);
  useEffect(() => {
    if (article.script !== scriptRef.current) {
      scriptRef.current = article.script;
      setPrompts(buildImagePrompts(article.script ?? "", article.title));
    }
  }, [article.script, article.title]);

  const updateImage = (idx: number, url: string) => {
    const updated = [...images];
    updated[idx] = url;
    setImages(updated);
    onSave({ image_paths: JSON.stringify(updated) });
  };

  const generateOne = async (idx: number) => {
    setGenerating(idx);
    setError("");
    try {
      const res = await fetch(`/api/articles/${article.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          index: idx,
          prompt: prompts[idx],
          previousPrompts: prompts.slice(0, idx),
          title: article.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "이미지 생성 오류");
      updateImage(idx, data.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setGenerating(null);
    }
  };

  const generateAll = async () => {
    setGeneratingAll(true);
    setError("");
    for (let i = 0; i < IMAGE_COUNT; i++) {
      await generateOne(i);
    }
    setGeneratingAll(false);
  };

  const costNote = "DALL-E 3 기준 장당 $0.08 → 6장 = $0.48";

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>이미지 생성</Label>
          <p className="text-xs text-gray-400">60초 숏츠 기준 {IMAGE_COUNT}장 · 9:16 세로형 · {costNote}</p>
        </div>
        <button
          onClick={generateAll}
          disabled={generating !== null || generatingAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
        >
          {generatingAll ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          전체 생성
        </button>
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

      {!article.script && (
        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          스크립트를 먼저 생성하면 섹션별 이미지 프롬프트가 자동으로 만들어집니다.
        </p>
      )}

      <div className="space-y-6">
        {Array.from({ length: IMAGE_COUNT }).map((_, i) => (
          <ImageSlot
            key={i}
            index={i}
            url={images[i]}
            prompt={prompts[i] ?? ""}
            loading={generating === i}
            onGenerate={() => generateOne(i)}
            onPromptChange={(v) => {
              const next = [...prompts];
              next[i] = v;
              setPrompts(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ImageSlot({
  index, url, prompt, loading, onGenerate, onPromptChange,
}: {
  index: number; url?: string; prompt: string; loading: boolean;
  onGenerate: () => void; onPromptChange: (v: string) => void;
}) {
  const sectionLabels = ["훅 ①", "훅 ②", "본문 ①", "본문 ②", "본문 ③", "마무리"];
  return (
    <div className="border rounded-xl overflow-hidden bg-gray-50">
      {/* 레이블 */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white">
        <span className="text-xs font-semibold text-purple-600">{sectionLabels[index]}</span>
        <span className="text-xs text-gray-400">장면 {index + 1}/6 · 약 10초</span>
      </div>

      <div className="flex gap-3 p-3">
        {/* 이미지 */}
        <div className="flex-shrink-0 w-48 h-[340px] relative flex items-center justify-center bg-gray-200 rounded-lg overflow-hidden">
          {url ? (
            <img src={url} alt={`이미지 ${index + 1}`} className="w-full h-full object-cover" />
          ) : (
            <div className="text-center text-gray-400">
              <ImageIcon size={32} className="mx-auto mb-2" />
              <p className="text-xs">미생성</p>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <Loader2 size={28} className="animate-spin text-purple-600" />
            </div>
          )}
        </div>

        {/* 프롬프트 + 버튼 */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <label className="text-[11px] text-gray-500 font-medium">장면 설명 (프롬프트)</label>
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            rows={8}
            placeholder="이 장면에 그릴 내용을 입력하세요"
            className="flex-1 w-full text-xs border rounded-lg px-2 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 bg-white leading-relaxed"
          />
          <button
            onClick={onGenerate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : url ? <RefreshCw size={12} /> : <Wand2 size={12} />}
            {url ? "재생성" : "생성"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────── 음성(TTS) 탭 ────────────── */
function TtsTab({
  article,
  onSave,
}: {
  article: ArticleDetail;
  onSave: (fields: Partial<ArticleDetail>) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(article.tts_path ?? "");
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  const generate = async () => {
    if (!article.script) { setError("스크립트를 먼저 생성해주세요."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/articles/${article.id}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: article.script }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "TTS 생성 오류");
      setAudioUrl(data.url);
      // tts_path는 서버에서 실제 파일 경로로 이미 저장됨 — 덮어쓰지 않음
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  return (
    <div className="p-5 space-y-4">
      <Label>음성(TTS) 생성</Label>

      {!article.script && (
        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          스크립트를 먼저 생성해주세요.
        </p>
      )}

      <button
        onClick={generate}
        disabled={loading || !article.script}
        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
        {audioUrl ? "음성 재생성" : "음성 생성"}
      </button>

      {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

      {audioUrl && (
        <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4 border">
          <button
            onClick={togglePlay}
            className="w-12 h-12 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-full"
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">음성 파일</p>
            <p className="text-xs text-gray-400 truncate">{audioUrl}</p>
          </div>
          <a href={audioUrl} download className="text-gray-400 hover:text-gray-700">
            <Download size={16} />
          </a>
          <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
        </div>
      )}
    </div>
  );
}

/* ────────────── 자막 탭 ────────────── */
function SubtitleTab({ article }: { article: ArticleDetail }) {
  const scriptLines = (article.script ?? "")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("["));

  if (scriptLines.length === 0) {
    return (
      <div className="p-5">
        <p className="text-sm text-gray-400">스크립트를 먼저 생성해주세요.</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      <Label>자막 목록</Label>
      <p className="text-xs text-gray-400">스크립트 줄 단위로 자동 배치 · 하단 · 28px</p>
      <div className="space-y-1">
        {scriptLines.map((line, i) => (
          <div key={i} className="flex items-start gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm">
            <span className="text-xs text-gray-400 font-mono w-5 flex-shrink-0 pt-0.5">{i + 1}</span>
            <span className="text-gray-800 leading-snug">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────── 미리보기 탭 ────────────── */
const FONT_SIZE_OPTIONS = [70, 80, 90, 100, 110, 120, 130, 150, 180];

function wrapSubtitle(text: string, maxChars = 13): string {
  const tokens = text.split(/(?<=[ ,!?])/u).map((t) => t.trim()).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const token of tokens) {
    if (!current) {
      current = token;
    } else if ((current + " " + token).length <= maxChars) {
      current += " " + token;
    } else {
      lines.push(current);
      current = token;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function PreviewTab({ article }: { article: ArticleDetail }) {
  const images: string[] = (() => {
    try { return article.image_paths ? JSON.parse(article.image_paths) : []; } catch { return []; }
  })();
  const savedStats: YoutubeStats | null = (() => {
    try { return article.youtube_stats ? JSON.parse(article.youtube_stats) : null; } catch { return null; }
  })();

  const hasImages = images.length > 0;
  const hasScript = !!article.script;
  const hasAudio = !!article.tts_path;
  const readyCount = [hasScript, hasImages, hasAudio].filter(Boolean).length;

  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [fontSize, setFontSize] = useState(110);
  const [previewLineIdx, setPreviewLineIdx] = useState(0);

  // YouTube
  const [ytLink, setYtLink] = useState(article.youtube_video_id
    ? `https://youtu.be/${article.youtube_video_id}` : "");
  const [ytSaving, setYtSaving] = useState(false);
  const [ytFetching, setYtFetching] = useState(false);
  const [ytStats, setYtStats] = useState<YoutubeStats | null>(savedStats);
  const [ytError, setYtError] = useState("");

  const scriptLines = (article.script ?? "")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("["));

  const compose = async () => {
    setComposing(true);
    setComposeError("");
    try {
      const res = await fetch(`/api/articles/${article.id}/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontSize }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "영상 합성 오류");
      const a = document.createElement("a");
      a.href = data.url;
      a.download = `shorts_${article.id}.mp4`;
      a.click();
    } catch (e: unknown) {
      setComposeError(e instanceof Error ? e.message : "오류");
    } finally {
      setComposing(false);
    }
  };

  // YouTube 링크 → video_id 추출
  const extractVideoId = (link: string): string | null => {
    const m = link.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
    return m ? m[1] : null;
  };

  const saveYtLink = async () => {
    const videoId = extractVideoId(ytLink.trim());
    if (!videoId) { setYtError("올바른 YouTube 링크가 아닙니다."); return; }
    setYtSaving(true);
    setYtError("");
    try {
      await fetch(`/api/articles/${article.id}/youtube-stats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_video_id: videoId }),
      });
    } finally {
      setYtSaving(false);
    }
  };

  const fetchStats = async () => {
    const videoId = extractVideoId(ytLink.trim());
    if (!videoId) { setYtError("먼저 링크를 저장하세요."); return; }
    // 저장 먼저
    await fetch(`/api/articles/${article.id}/youtube-stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtube_video_id: videoId }),
    });
    setYtFetching(true);
    setYtError("");
    try {
      const res = await fetch(`/api/articles/${article.id}/youtube-stats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setYtStats(data);
    } catch (e: unknown) {
      setYtError(e instanceof Error ? e.message : "오류");
    } finally {
      setYtFetching(false);
    }
  };

  // 미리보기 이미지: 자막 라인 인덱스 기준으로 이미지 선택
  const imgIdx = images.length > 0
    ? Math.min(Math.floor(previewLineIdx / Math.max(1, scriptLines.length) * images.length), images.length - 1)
    : 0;

  // 자막 폰트 크기를 미리보기 컨테이너(9:16, maxW=216px)에 맞게 스케일
  // 실제 영상: 1080px 폭 → 미리보기: ~216px → scale ≈ 0.2
  const previewScale = 216 / 1080;
  const previewFontSize = Math.round(fontSize * previewScale);

  return (
    <div className="p-5 space-y-5">
      {/* 준비 상태 */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <Label>제작 준비 현황</Label>
        {[
          { label: "스크립트", done: hasScript },
          { label: `이미지 (${images.length}/${IMAGE_COUNT}장)`, done: hasImages },
          { label: "음성(TTS)", done: hasAudio },
        ].map(({ label, done }) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"}`}>
              {done ? "✓" : ""}
            </span>
            <span className={done ? "text-gray-800" : "text-gray-400"}>{label}</span>
          </div>
        ))}
      </div>

      {/* 자막 크기 선택 */}
      <div>
        <Label>자막 크기</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {FONT_SIZE_OPTIONS.map((px) => (
            <button
              key={px}
              onClick={() => setFontSize(px)}
              className={`px-3 py-1 rounded-lg text-sm font-medium border transition-colors ${
                fontSize === px
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
            >
              {px}px
            </button>
          ))}
        </div>
      </div>

      {readyCount < 3 ? (
        <div className="text-center py-8 text-gray-400">
          <Maximize2 size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">스크립트, 이미지, 음성이 모두 준비되면</p>
          <p className="text-sm">영상을 합성할 수 있습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 9:16 미리보기 */}
          <div
            className="relative bg-black rounded-xl overflow-hidden mx-auto"
            style={{ width: 216, height: 384 }}
          >
            {images[imgIdx] && (
              <img src={images[imgIdx]} alt="preview" className="absolute inset-0 w-full h-full object-cover opacity-90" />
            )}
            {/* 자막 오버레이 */}
            {scriptLines[previewLineIdx] && (
              <div
                className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-6 px-2"
              >
                <p
                  className="text-white text-center font-bold leading-snug"
                  style={{
                    fontSize: previewFontSize,
                    textShadow: "0 0 8px #000, 0 0 4px #000, 2px 2px 6px #000",
                    WebkitTextStroke: "0.5px black",
                    whiteSpace: "pre-line",
                  }}
                >
                  {wrapSubtitle(scriptLines[previewLineIdx])}
                </p>
              </div>
            )}
          </div>

          {/* 자막 라인 선택 */}
          {scriptLines.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2 bg-gray-50">
              <p className="text-[11px] text-gray-400 font-medium px-1 mb-1">자막 라인 클릭 → 미리보기</p>
              {scriptLines.map((line, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewLineIdx(i)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-start gap-2 transition-colors ${
                    previewLineIdx === i
                      ? "bg-blue-100 text-blue-800 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="text-[10px] text-gray-400 font-mono w-5 flex-shrink-0 pt-0.5">{i + 1}</span>
                  {line}
                </button>
              ))}
            </div>
          )}

          {composeError && (
            <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{composeError}</p>
          )}

          <button
            onClick={compose}
            disabled={composing}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {composing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {composing ? "영상 합성 중... (30초~1분 소요)" : `영상 합성 & 다운로드 (${fontSize}px)`}
          </button>
        </div>
      )}
      {/* YouTube 링크 & 반응 수집 */}
      <div className="border rounded-xl p-4 space-y-3 bg-red-50/40">
        <Label>YouTube 업로드 후 반응 수집</Label>

        <div className="flex gap-2">
          <input
            value={ytLink}
            onChange={(e) => { setYtLink(e.target.value); setYtError(""); }}
            placeholder="https://youtu.be/xxxxxxx 또는 youtube.com/shorts/..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
          />
          <button
            onClick={saveYtLink}
            disabled={ytSaving || !ytLink.trim()}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium whitespace-nowrap"
          >
            {ytSaving ? <Loader2 size={14} className="animate-spin" /> : "저장"}
          </button>
        </div>

        {ytError && <p className="text-red-500 text-xs bg-red-100 px-3 py-2 rounded-lg">{ytError}</p>}

        <button
          onClick={fetchStats}
          disabled={ytFetching || !ytLink.trim()}
          className="w-full flex items-center justify-center gap-2 py-2 border border-red-300 hover:bg-red-100 disabled:opacity-50 text-red-700 rounded-lg text-sm font-medium"
        >
          {ytFetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          지금 반응 가져오기
        </button>

        {ytStats && (
          <div className="grid grid-cols-3 gap-2 mt-1">
            {[
              { label: "조회수", value: ytStats.views.toLocaleString() },
              { label: "좋아요", value: ytStats.likes.toLocaleString() },
              { label: "댓글", value: ytStats.comments.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-lg p-3 text-center border">
                <p className="text-lg font-bold text-gray-900">{value}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
            <p className="col-span-3 text-[11px] text-gray-400 text-right">
              기준: {new Date(ytStats.checked_at).toLocaleString("ko-KR")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────── 유틸 ────────────── */
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{children}</p>;
}

function YouTubeEmbed({ url }: { url: string }) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]+)/);
  if (!match) return null;
  return (
    <div>
      <Label>유튜브 영상</Label>
      <div className="aspect-video rounded-lg overflow-hidden">
        <iframe
          src={`https://www.youtube.com/embed/${match[1]}`}
          className="w-full h-full"
          allowFullScreen
        />
      </div>
    </div>
  );
}
