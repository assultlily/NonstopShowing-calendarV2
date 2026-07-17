"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 記錄到 console，方便之後對照使用者回報的問題
    console.error("未預期的錯誤：", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl text-center">
        <div className="w-12 h-12 rounded-full bg-rose-950/50 border border-rose-900 flex items-center justify-center mx-auto">
          <AlertTriangle size={22} className="text-rose-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-slate-100">
            糟糕，畫面出現未預期的錯誤
          </h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            這不是你的操作問題，是程式本身發生了意外狀況。你的資料已經同步在雲端，重試或重新整理後應該就能恢復正常。
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold py-2 rounded-lg transition-all active:scale-95"
          >
            <RotateCcw size={14} />
            重試
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold py-2 rounded-lg transition-all active:scale-95"
          >
            <Home size={14} />
            回首頁
          </button>
        </div>

        {error.digest && (
          <p className="text-[10px] text-slate-600 font-mono pt-2">
            錯誤代碼：{error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
