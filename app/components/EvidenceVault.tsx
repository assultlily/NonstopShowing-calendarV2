import { useEffect, useRef, useState } from "react";
import { Archive, Cloud, CloudDownload, Download, Loader2, Paperclip, Shield, Trash2, Upload } from "lucide-react";
import {
  CLOUD_KEEP_DAYS,
  CloudCopy,
  EVIDENCE_ACCEPT,
  EVIDENCE_DISCLAIMER,
  EVIDENCE_KINDS,
  EVIDENCE_MAX_FILES,
  EvidenceFile,
  EvidenceKind,
  addEvidence,
  backupToCloud,
  checkEvidenceFile,
  currentUserId,
  getCloudConsent,
  listCloud,
  listLocal,
  openEvidence,
  packEvidence,
  removeEvidence,
  restoreFromCloud,
  setCloudConsent,
  updateEvidence,
  withdrawCloudConsent,
} from "../lib/evidenceApi";
import { LangType } from "../lib/translations";

interface Props {
  eventId: string;
  eventTitle: string;
  lang: LangType;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fmtSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + " MB" : Math.ceil(bytes / 1024) + " KB";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const byTime = (a: EvidenceFile, b: EvidenceFile) => a.capturedAt.localeCompare(b.capturedAt);

// 消費爭議存證：預設只存在這台裝置；使用者同意後才暫存到雲端
export default function EvidenceVault({ eventId, eventTitle, lang }: Props) {
  const zh = lang === "zh";
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [files, setFiles] = useState<EvidenceFile[] | null>(null);
  const [consent, setConsent] = useState(false);
  const [cloudOnly, setCloudOnly] = useState<CloudCopy[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 展開才讀取
  useEffect(() => {
    if (!open || files !== null) return;
    (async () => {
      try {
        const id = await currentUserId();
        setUid(id);
        const local = await listLocal(id, eventId);
        setFiles(local);
        const agreed = getCloudConsent(id);
        setConsent(agreed);
        if (agreed) await syncCloud(local);
      } catch (e) {
        setFiles([]);
        setMsg((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, files, eventId]);

  // 已同意：把還沒備份的補上去，並列出雲端有、這台裝置沒有的
  async function syncCloud(local: EvidenceFile[]) {
    setBusy("同步雲端暫存…");
    try {
      const cloud = await listCloud(eventId);
      const cloudIds = new Set(cloud.map((c) => c.id));
      const localIds = new Set(local.map((f) => f.id));
      let next = local.map((f) => {
        const c = cloud.find((x) => x.id === f.id);
        return { ...f, cloudExpiresAt: c ? c.expiresAt : null };
      });
      for (const f of next.filter((x) => !cloudIds.has(x.id))) {
        const saved = await backupToCloud(f);
        next = next.map((x) => (x.id === saved.id ? saved : x));
      }
      setFiles(next.sort(byTime));
      setCloudOnly(cloud.filter((c) => !localIds.has(c.id)));
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(null);
  }

  async function onPick(list: FileList | null) {
    if (!list || !files || !uid) return;
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
      setBusy(`加入中 ${i + 1}/${ok.length}…`);
      try {
        let rec = await addEvidence(uid, eventId, ok[i]);
        if (consent) {
          try {
            rec = await backupToCloud(rec);
          } catch (e) {
            problems.push(`${ok[i].name}：已存在本機，雲端暫存失敗（${(e as Error).message}）`);
          }
        }
        next = [...next, rec].sort(byTime);
        setFiles(next);
      } catch (e) {
        problems.push(`${ok[i].name}：${(e as Error).message}`);
      }
    }
    setBusy(null);
    setMsg(problems.length ? problems.join("\n") : null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function patch(f: EvidenceFile, change: Partial<Pick<EvidenceFile, "kind" | "capturedAt" | "note">>) {
    try {
      const saved = await updateEvidence(f, change);
      setFiles((prev) => (prev ? prev.map((x) => (x.id === f.id ? saved : x)).sort(byTime) : prev));
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function remove(f: EvidenceFile) {
    const where = f.cloudExpiresAt ? "（本機與雲端暫存都會刪除）" : "";
    if (!window.confirm(`刪除「${f.fileName}」？刪除後無法復原。${where}`)) return;
    try {
      await removeEvidence(f);
      setFiles((prev) => (prev ? prev.filter((x) => x.id !== f.id) : prev));
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function toggleConsent(on: boolean) {
    if (!uid || !files) return;
    if (on) {
      const ok = window.confirm(
        `同意將存證檔案的副本暫存到雲端？\n\n` +
          `・用途：換裝置時可以取回，或避免清除瀏覽器資料後遺失。\n` +
          `・保存 ${CLOUD_KEEP_DAYS} 天，到期自動刪除；隨時可取消勾選，雲端副本會立即刪除。\n` +
          `・只有你登入的帳號看得到。\n\n不同意也能正常使用，檔案只會留在這台裝置。`
      );
      if (!ok) return;
      setCloudConsent(uid, true);
      setConsent(true);
      await syncCloud(files);
    } else {
      if (!window.confirm("取消同意後，會立即刪除你在雲端的所有存證暫存副本（這台裝置上的檔案不受影響）。確定？")) return;
      setBusy("刪除雲端暫存…");
      try {
        const n = await withdrawCloudConsent(uid);
        setConsent(false);
        setCloudOnly([]);
        setFiles((prev) => (prev ? prev.map((x) => ({ ...x, cloudExpiresAt: null })) : prev));
        setMsg(`已刪除雲端暫存 ${n} 件。`);
      } catch (e) {
        setMsg((e as Error).message);
      }
      setBusy(null);
    }
  }

  async function restoreAll() {
    const restored: EvidenceFile[] = [];
    for (let i = 0; i < cloudOnly.length; i++) {
      setBusy(`取回中 ${i + 1}/${cloudOnly.length}…`);
      try {
        restored.push(await restoreFromCloud(cloudOnly[i]));
      } catch (e) {
        setMsg((e as Error).message);
      }
    }
    setFiles((prev) => [...(prev || []), ...restored].sort(byTime));
    setCloudOnly((prev) => prev.filter((c) => !restored.some((r) => r.id === c.id)));
    setBusy(null);
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
        <span className="text-[10px] text-slate-600">{open ? (zh ? "收合" : "Hide") : zh ? "展開" : "Show"}</span>
      </button>

      {open && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-2">
          <p className="text-[10px] leading-relaxed text-amber-200/80 bg-amber-950/20 border border-amber-900/40 rounded p-2">
            {EVIDENCE_DISCLAIMER}
          </p>
          <p className="text-[10px] text-slate-500">
            {zh
              ? `檔案只存在這台裝置的瀏覽器裡。收截圖、照片、票根、PDF、文字頁面；單檔 5MB 以內，每張卡最多 ${EVIDENCE_MAX_FILES} 件。依檔案時間自動排序。清除瀏覽器資料前，請先打包下載。`
              : `Files stay in this browser only. ≤5MB each, up to ${EVIDENCE_MAX_FILES} per card. Download a ZIP before clearing browser data.`}
          </p>

          <label className="flex items-start gap-1.5 text-[10px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              disabled={!!busy || !uid}
              onChange={(e) => toggleConsent(e.target.checked)}
              className="mt-0.5 accent-amber-500"
            />
            <span>
              {zh
                ? `同意把副本暫存到雲端（${CLOUD_KEEP_DAYS} 天後自動刪除，可隨時取消並立即刪除）`
                : `Keep a cloud copy (auto-deleted after ${CLOUD_KEEP_DAYS} days; revoke anytime)`}
            </span>
          </label>

          {cloudOnly.length > 0 && (
            <button
              type="button"
              disabled={!!busy}
              onClick={restoreAll}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] border border-sky-800/60 bg-sky-950/30 text-sky-300 hover:bg-sky-950/60 disabled:opacity-40"
            >
              <CloudDownload size={12} />
              {zh ? `雲端暫存有 ${cloudOnly.length} 件不在這台裝置，取回` : `Restore ${cloudOnly.length} from cloud`}
            </button>
          )}

          <div className="flex gap-2">
            <input ref={inputRef} type="file" multiple accept={EVIDENCE_ACCEPT} className="hidden" onChange={(e) => onPick(e.target.files)} />
            <button
              type="button"
              disabled={!!busy || files === null || !uid || files.length >= EVIDENCE_MAX_FILES}
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
            <p className="text-[10px] text-slate-600">{zh ? "這台裝置上還沒有存證檔案。" : "No evidence on this device yet."}</p>
          ) : (
            <ol className="space-y-1.5">
              {files.map((f, i) => (
                <li key={f.id} className="border border-slate-800 rounded p-1.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-600 font-mono w-5">{String(i + 1).padStart(2, "0")}</span>
                    <button
                      type="button"
                      onClick={() => openEvidence(f)}
                      className="flex-1 min-w-0 truncate text-left text-slate-300 hover:text-purple-300 flex items-center gap-1"
                      title={f.fileName}
                    >
                      <Paperclip size={10} className="flex-shrink-0" />
                      <span className="truncate">{f.fileName}</span>
                    </button>
                    {f.cloudExpiresAt && (
                      <span
                        className="text-sky-500 flex items-center gap-0.5 text-[9px] flex-shrink-0"
                        title={zh ? `雲端暫存至 ${fmtDate(f.cloudExpiresAt)}` : `Cloud copy until ${fmtDate(f.cloudExpiresAt)}`}
                      >
                        <Cloud size={10} />
                        {fmtDate(f.cloudExpiresAt)}
                      </span>
                    )}
                    <span className="text-slate-600 text-[10px] flex-shrink-0">{fmtSize(f.sizeBytes)}</span>
                    <button type="button" onClick={() => openEvidence(f)} className="text-slate-500 hover:text-slate-200" aria-label={zh ? "開啟" : "Open"}>
                      <Download size={11} />
                    </button>
                    <button type="button" onClick={() => remove(f)} className="text-slate-600 hover:text-rose-400" aria-label={zh ? "刪除" : "Delete"}>
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
                        <option key={k} value={k}>
                          {k}
                        </option>
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
