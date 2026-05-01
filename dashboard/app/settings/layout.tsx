import Link from "next/link";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">← 대시보드</Link>
          <span className="text-gray-300">|</span>
          <nav className="flex gap-1">
            <Link href="/settings/keys" className="text-sm px-3 py-1.5 rounded hover:bg-gray-100 text-gray-600">API 키</Link>
            <Link href="/settings/channels" className="text-sm px-3 py-1.5 rounded hover:bg-gray-100 text-gray-600">채널</Link>
            <Link href="/settings/ai" className="text-sm px-3 py-1.5 rounded hover:bg-gray-100 text-gray-600">AI 설정</Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
