import { useEffect, useRef, useState } from "react";
import { Archive, Download, Loader2, Paperclip, Shield, Trash2, Upload } from "lucide-react";
import {
  EVIDENCE_ACCEPT,
  EVIDENCE_DISCLAIMER,
  EVIDENCE_KINDS,
  EVIDENCE_MAX_FILES,
  EvidenceFile,
  EvidenceKind,
  checkEvidenceFile,
  deleteEvidence,
  getEvidenceUrl,
  listEvidence,
  packEvidence,
  updateEvidence,
  uploadEvidence,
} from "../lib/evidenceApi";
import { LangType } from "../lib/translations";

interface Props {
  eventId: string;
  eventTitle: string;
  lang: LangType;
}

// ISO → <input type="datetime-local"> 用的本地時間字串
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function fmtSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? (bytes / 1024 / 1024).toFixed(1) + " MB"
    : Math.ceil(bytes / 1024) + " KB";
}

// 消費爭議存證：預設收合，展開才讀取，避免每張卡都去抓資料
export default function EvidenceVault({ eventId, eventTitle, lang }: Props) {
  const zh = lang === "zh";
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<EvidenceFile[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sortList = (list: EvidenceFile[]) =>
    [...list].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  useEffect(() => {
    if (!open || files !== null) return;
    listEvidence(eventId)
      .then(setFiles)
      .catch((e) => setMsg(String(e.message || e)));
  }, [open, files, eventId]);

  async function onPick(list: FileList | null) {
    if (!list || !files) return;
    const picked = Array.from(list);
    const room = EVIDENCE_MAX_FILES - files.length;
    const problems: string[] = [];
    const ok = picked.filter((f) => {
      const p = checkEvidenceFile(f);
      if (p) problems.push(`${f.name}：${p}`);
      return !p;
    });
    if (ok.length > room) {
      problems.push(`每張卡最多 ${EVIDENCE_MAX_FILES} 件，這次只收前 ${Math.max(room, 0)} 件`);
      ok.splice(Math.max(room, 0));
    }
    let next = files;
    for (let i = 0; i < ok.length; i++) {
      setBusy(`上傳中 ${i + 1}/${ok.length}…`);
      try {
        const saved = await uploadEvidence(eventId, ok[i]);
        next = sortList([...next, saved]);
        setFiles(next);
      } catch (e) {
        problems.push(`${ok[i].name}：${(e as Error).message}`);
      }
    }
    setBusy(null);
    setMsg(problems.length ? problems.join("\n") : null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function patch(f: EvidenceFile, change: Partial<EvidenceFile>) {
    const updated = { ...f, ...change };
    setFiles((prev) => (prev ? sortList(prev.map((x) => (x.id === f.id ? updated : x))) : prev));
    try {
      await updateEvidence(f.id, change);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function remove(f: EvidenceFile) {
    if (!window.confirm(`刪除「${f.fileName}」？刪除後無法復原。`)) return;
    try {
      await deleteEvidence(f);
      setFiles((prev) => (prev ? prev.filter((x) => x.id !== f.id) : prev));
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function view(f: EvidenceFile) {
    try {
      window.open(await getEvidenceUrl(f), "_blank", "noopener,noreferrer");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function pack() {
    if (!files?.length) return;
    setBusy("打包中…");
    try {
      const blob = await packEvidence(eventTitle, files);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `存證_${eventTitle.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(null);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-slate-400 font-medium hover:text-slate-200"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1">
          <Shield size={12} className="text-amber-400" />
          {zh ? "🧾 消費爭議存證" : "🧾 Dispute Evidence"}
          {files && <span className="text-slate-600 text-[10px] ml-1">{files.length}/{EVIDENCE_MAX_FILES}</span>}
        </span>
        <span className="text-[10px] text-slate-600">{open ? (zh ? "收合" : "Hide") : (zh ? "展開" : "Show")}</span>
      </button>

      {open && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-2">
          <p className="text-[10px] leading-relaxed text-amber-200/80 bg-amber-950/20 border border-amber-900/40 rounded p-2">
            {EVIDENCE_DISCLAIMER}
          </p>
          <p className="text-[10px] text-slate-500">
            {zh
              ? `收截圖、照片、票根、PDF、文字頁面；單檔 5MB 以內，每張卡最多 ${EVIDENCE_MAX_FILES} 件。依檔案時間自動排序。`
              : `Screenshots, photos, tickets, PDFs, text pages; ≤5MB each, up to ${EVIDENCE_MAX_FILES} per card.`}
          </p>

          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={EVIDENCE_ACCEPT}
              className="hidden"
              onChange={(e) => onPick(e.target.files)}
            />
            <button
              type="button"
              disabled={!!busy || files === null || files.length >= EVIDENCE_MAX_FILES}
              onClick={() => inputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              <Upload size={12} /> {zh ? "加入檔案" : "Add files"}
            </button>
            <button
              type="button"
              disabled={!!busy || !files?.length}
              onClick={pack}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold border border-amber-800/60 bg-amber-950/30 text-amber-300 hover:bg-amber-950/60 disabled:opacity-40"
            >
              <Archive size={12} /> {zh ? "一鍵整理打包" : "Pack as ZIP"}
            </button>
          </div>

          {busy && (
            <p className="flex items-center gap-1 text-[10px] text-slate-400">
              <Loader2 size={10} className="animate-spin" /> {busy}
            </p>
          )}
          {msg && <p className="text-[10px] text-rose-400 whitespace-pre-line">{msg}</p>}

          {files === null ? (
            <p className="text-[10px] text-slate-600">{zh ? "讀取中…" : "Loading…"}</p>
          ) : files.length === 0 ? (
            <p className="text-[10px] text-slate-600">{zh ? "還沒有存證檔案。" : "No evidence yet."}</p>
          ) : (
            <ol className="space-y-1.5">
              {files.map((f, i) => (
                <li key={f.id} className="border border-slate-800 rounded p-1.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-600 font-mono w-5">{String(i + 1).padStart(2, "0")}</span>
                    <button
                      type="button"
                      onClick={() => view(f)}
                      className="flex-1 min-w-0 truncate text-left text-slate-300 hover:text-purple-300 flex items-center gap-1"
                      title={f.fileName}
                    >
                      <Paperclip size={10} className="flex-shrink-0" />
                      <span className="truncate">{f.fileName}</span>
                    </button>
                    <span className="text-slate-600 text-[10px] flex-shrink-0">{fmtSize(f.sizeBytes)}</span>
                    <button
                      type="button"
                      onClick={() => view(f)}
                      className="text-slate-500 hover:text-slate-200"
                      aria-label={zh ? "開啟" : "Open"}
                    >
                      <Download size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(f)}
                      className="text-slate-600 hover:text-rose-400"
                      aria-label={zh ? "刪除" : "Delete"}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div className="flex gap-1.5 pl-6">
                    <input
                      type="datetime-local"
                      value={toLocalInput(f.capturedAt)}
                      onChange={(e) => {
                        if (e.target.value) patch(f, { capturedAt: new Date(e.target.value).toISOString() });
                      }}
                      className="bg-slate-900 text-slate-400 border border-slate-800 rounded px-1 py-0.5 text-[10px] min-w-0"
                      aria-label={zh ? "時間" : "Time"}
                    />
                    <select
                      value={f.kind}
                      onChange={(e) => patch(f, { kind: e.target.value as EvidenceKind })}
                      className="bg-slate-900 text-slate-400 border border-slate-800 rounded px-1 py-0.5 text-[10px]"
                      aria-label={zh ? "類型" : "Kind"}
                    >
                      {EVIDENCE_KINDS.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
