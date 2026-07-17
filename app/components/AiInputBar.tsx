import { Sparkles, RotateCcw } from "lucide-react";
import { LangType } from "../lib/translations";
import { ShowEvent } from "../mockEvents";

interface AiInputBarProps {
  lang: LangType;
  aiInput: string;
  setAiInput: (value: string) => void;
  aiNotice: string;
  isProcessing: boolean;
  previousEvents: ShowEvent[] | null;
  onProcess: (input: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onUndo: () => void;
}

export default function AiInputBar({
  lang,
  aiInput,
  setAiInput,
  aiNotice,
  isProcessing,
  previousEvents,
  onProcess,
  onKeyDown,
  onUndo,
}: AiInputBarProps) {
  return (
    <section className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3 text-purple-400 font-medium text-sm">
        <span className="flex items-center gap-2">
          <Sparkles size={16} />{" "}
          {lang === "zh"
            ? "語意動態感測與卡片建構入口"
            : "Semantic Intelligence Entry"}
        </span>
        <span className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-emerald-400 font-medium">
          💡{" "}
          {lang === "zh"
            ? "直接在下方貼上網址並按 Enter！"
            : "Directly paste ticketing link and press Enter!"}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <textarea
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            lang === "zh"
              ? "在此貼上任何售票網址（如 拓元/KKTIX/OPENTIX/eplus/pia 等）或輸入指令，完成後按 Enter！"
              : "Paste ticketing links (tixCraft/KKTIX/OPENTIX/eplus/pia) or command, then press Enter!"
          }
          className="flex-grow bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-colors h-16 resize-none"
        />
        <button
          onClick={() => onProcess(aiInput)}
          disabled={isProcessing}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed border border-purple-500 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all shadow-md active:scale-95 flex items-center justify-center flex-shrink-0"
        >
          {isProcessing
            ? lang === "zh"
              ? "⏳ 讀取中..."
              : "⏳ Loading..."
            : `⚡ ${lang === "zh" ? "智慧感測" : "Analyze"}`}
        </button>
      </div>

      {aiNotice && (
        <div className="mt-2 text-xs bg-slate-950 border border-slate-800 p-2.5 rounded-lg flex justify-between items-center animate-fadeIn">
          <span className="text-emerald-400 font-medium whitespace-pre-line leading-relaxed">
            {aiNotice}
          </span>
          {previousEvents && (
            <button
              onClick={onUndo}
              className="flex items-center gap-1.5 bg-purple-900/40 hover:bg-purple-800 border border-purple-700 hover:border-purple-600 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-purple-200 transition-all shadow-md active:scale-95 flex-shrink-0"
            >
              <RotateCcw size={12} /> ↩️{" "}
              {lang === "zh" ? "撤銷 (Ctrl+Z)" : "Undo (Ctrl+Z)"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
