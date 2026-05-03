"use client";
import { useEffect, useState } from "react";
import { ExternalLink, MessageCircle, Eye } from "lucide-react";

type CommunityPost = {
  id: number;
  source: string;
  title: string;
  url: string;
  comment_cnt: number;
  view_cnt: number;
  collected_at: string;
};

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function CommunitySignals({ categoryId }: { categoryId: number }) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/community?categoryId=${categoryId}`)
      .then((r) => r.json())
      .then((data) => { setPosts(data); setLoading(false); });
  }, [categoryId]);

  if (loading) return null;
  if (posts.length === 0) return null;

  const hot = posts.filter((p) => p.comment_cnt >= 5);
  const normal = posts.filter((p) => p.comment_cnt < 5);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-700">다모앙 커뮤니티 반응</h2>
        <span className="text-xs text-gray-400">{posts.length}건</span>
        {hot.length > 0 && (
          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
            HOT {hot.length}건
          </span>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
    </div>
  );
}

function PostCard({ post }: { post: CommunityPost }) {
  const isHot = post.comment_cnt >= 5;

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noreferrer"
      className={`flex-shrink-0 w-52 rounded-lg p-3 text-xs border transition-shadow hover:shadow-md ${
        isHot
          ? "bg-red-50 border-red-200"
          : "bg-white border-gray-200"
      }`}
    >
      <p className="font-medium text-gray-800 leading-snug line-clamp-3 mb-2">
        {post.title}
      </p>

      <div className="flex items-center gap-1.5">
        {/* 댓글 뱃지 - 파란색 */}
        <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono font-semibold ${
          post.comment_cnt >= 5
            ? "bg-blue-500 text-white"
            : "bg-blue-100 text-blue-700"
        }`}>
          <MessageCircle size={9} />
          {post.comment_cnt}
        </span>

        {/* 조회수 뱃지 - 초록색 */}
        {post.view_cnt > 0 && (
          <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono font-semibold ${
            post.view_cnt >= 1000
              ? "bg-green-500 text-white"
              : "bg-green-100 text-green-700"
          }`}>
            <Eye size={9} />
            {fmtNum(post.view_cnt)}
          </span>
        )}

        <span className="ml-auto text-gray-400">{post.collected_at?.slice(5, 10)}</span>
      </div>
    </a>
  );
}
