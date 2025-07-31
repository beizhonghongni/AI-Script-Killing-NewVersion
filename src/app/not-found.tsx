export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/30 p-8 max-w-md w-full mx-4 text-center">
        <h1 className="text-6xl font-bold text-purple-400 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-white mb-4">页面未找到</h2>
        <p className="text-slate-300 mb-6">
          您访问的页面不存在或已被删除。
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          返回主页
        </a>
      </div>
    </div>
  );
}
