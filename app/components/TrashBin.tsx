import { Trash2, RotateCcw, X } from "lucide-react";
import { ShowEvent } from "../mockEvents";
import { LangType } from "../lib/translations";

interface TrashBinProps {
  lang: LangType;
  deletedEvents: ShowEvent[];
  onClose: () => void;
  onRestore: (eventId: string) => void;
  onPermanentlyDelete: (eventId: string) => void;
}

export default function TrashBin({
  lang,
  deletedEvents,
  onClose,
  onRestore,
  onPermanentlyDelete,
}: TrashBinProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Trash2 size={16} className="text-rose-400" />
            {lang === "zh" ? "垃圾桶" : "Trash Bin"}
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
              {deletedEvents.length}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-2 flex-1">
          {deletedEvents.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">
              {lang === "zh" ? "垃圾桶是空的" : "Trash bin is empty"}
            </p>
          ) : (
            deletedEvents.map((event) => (
              <div
                key={event.id}
                className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-200 truncate">
                    {event.title}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {event.showDate}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => onRestore(event.id)}
                    title={lang === "zh" ? "復原" : "Restore"}
                    className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800 hover:bg-emerald-900/50 px-2 py-1.5 rounded-lg transition-all active:scale-95"
                  >
                    <RotateCcw size={11} />
                    {lang === "zh" ? "復原" : "Restore"}
                  </button>
                  <button
                    onClick={() => onPermanentlyDelete(event.id)}
                    title={lang === "zh" ? "永久刪除" : "Delete forever"}
                    className="flex items-center gap-1 text-[10px] font-medium text-rose-400 bg-rose-950/30 border border-rose-900/60 hover:bg-rose-950/60 px-2 py-1.5 rounded-lg transition-all active:scale-95"
                  >
                    <Trash2 size={11} />
                    {lang === "zh" ? "永久刪除" : "Delete"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
