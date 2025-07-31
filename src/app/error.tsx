'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/30 p-8 max-w-md w-full mx-4">
        <h1 className="text-2xl font-bold text-white mb-4">出现错误</h1>
        <p className="text-slate-300 mb-6">
          抱歉，发生了一个错误。请尝试刷新页面或联系支持。
        </p>
        <div className="flex gap-4">
          <button
            onClick={reset}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            重试
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            返回主页
          </button>
        </div>
      </div>
    </div>
  );
}
