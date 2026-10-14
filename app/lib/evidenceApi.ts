import { zipSync, strToU8 } from "fflate";
import { supabase } from "./supabaseClient";

// 消費爭議存證：只收常見證據格式，限制單檔大小與每張卡的件數，避免量體膨脹
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024; // 單檔 5MB（資料庫與儲存桶也有同樣限制）
export const EVIDENCE_MAX_FILES = 30; // 每張活動卡最多 30 件（資料庫觸發器也會擋）
const BUCKET = "evidence";

export const EVIDENCE_KINDS = ["截圖", "照片", "票根", "PDF", "文字頁面"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_DISCLAIMER =
  "具體申訴對象與管道，請向演出發生地所在地方政府機關諮詢。本軟體所提資料皆由使用者自行登錄提供，僅作證據保全使用，不負擔任何法律上應由使用者證明之善良管理人之注意義務。";

// 副檔名 → MIME。以副檔名為準，因為部分瀏覽器對 HEIC、HTML 回報的類型不一致
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  txt: "text/plain",
  html: "text/html",
  htm: "text/html",
};

export const EVIDENCE_ACCEPT = Object.keys(EXT_TO_MIME)
  .map((ext) => "." + ext)
  .join(",");

export interface EvidenceFile {
  id: string;
  eventId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: EvidenceKind;
  capturedAt: string; // ISO
  sha256: string;
  note: string;
}

type EvidenceRow = {
  id: string;
  event_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: EvidenceKind;
  captured_at: string;
  sha256: string;
  note: string;
};

function rowToFile(r: EvidenceRow): EvidenceFile {
  return {
    id: r.id,
    eventId: r.event_id,
    storagePath: r.storage_path,
    fileName: r.file_name,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    kind: r.kind,
    capturedAt: r.captured_at,
    sha256: r.sha256,
    note: r.note,
  };
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

// 檢查檔案能不能收，不能收就回傳原因
export function checkEvidenceFile(file: File): string | null {
  if (!EXT_TO_MIME[extOf(file.name)]) {
    return "只收截圖、照片、PDF、票根、文字頁面（jpg、png、webp、heic、pdf、txt、html）";
  }
  if (file.size === 0) return "檔案是空的";
  if (file.size > EVIDENCE_MAX_BYTES) return "超過單檔 5MB 上限";
  return null;
}

export function guessKind(file: File): EvidenceKind {
  const ext = extOf(file.name);
  if (ext === "pdf") return "PDF";
  if (ext === "txt" || ext === "html" || ext === "htm") return "文字頁面";
  if (ext === "png" || ext === "webp") return "截圖";
  return "照片";
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 依時間排序（舊到新）
export async function listEvidence(eventId: string): Promise<EvidenceFile[]> {
  const { data, error } = await supabase
    .from("evidence_files")
    .select("*")
    .eq("event_id", eventId)
    .order("captured_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToFile);
}

export async function uploadEvidence(
  eventId: string,
  file: File
): Promise<EvidenceFile> {
  const problem = checkEvidenceFile(file);
  if (problem) throw new Error(problem);

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("請先登入");

  const ext = extOf(file.name);
  const mime = EXT_TO_MIME[ext];
  const buf = await file.arrayBuffer();
  const sha256 = await sha256Hex(buf);
  // 檔案的最後修改時間通常就是截圖或拍照時間；拿不到時用現在
  const capturedAt = new Date(file.lastModified || Date.now()).toISOString();
  const storagePath = `${uid}/${eventId}/${crypto.randomUUID()}.${ext}`;

  const up = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: mime, upsert: false });
  if (up.error) throw up.error;

  const { data, error } = await supabase
    .from("evidence_files")
    .insert({
      event_id: eventId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: mime,
      size_bytes: file.size,
      kind: guessKind(file),
      captured_at: capturedAt,
      sha256,
    })
    .select("*")
    .single();
  if (error) {
    // 索引寫不進去（例如超過件數上限）就把剛上傳的檔案收回，避免留下孤兒檔
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }
  return rowToFile(data as EvidenceRow);
}

export async function updateEvidence(
  id: string,
  patch: Partial<Pick<EvidenceFile, "kind" | "capturedAt" | "note">>
): Promise<void> {
  const row: Record<string, string> = {};
  if (patch.kind) row.kind = patch.kind;
  if (patch.capturedAt) row.captured_at = patch.capturedAt;
  if (patch.note !== undefined) row.note = patch.note;
  const { error } = await supabase.from("evidence_files").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteEvidence(file: EvidenceFile): Promise<void> {
  const { error } = await supabase.from("evidence_files").delete().eq("id", file.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([file.storagePath]);
}

export async function getEvidenceUrl(file: EvidenceFile): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

// 台北時間，給檔名與清單用
function stamp(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const t = new Date(d.getTime() + 8 * 3600 * 1000);
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}_${p(
    t.getUTCHours()
  )}${p(t.getUTCMinutes())}`;
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|\n\r\t]/g, "_").slice(0, 60);
}

// 一鍵打包：依時間排序、統一檔名、附清單（時間、類型、大小、SHA-256、備註）與聲明
export async function packEvidence(
  eventTitle: string,
  files: EvidenceFile[]
): Promise<Blob> {
  const sorted = [...files].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const entries: Record<string, Uint8Array> = {};
  const lines: string[] = [
    `活動：${eventTitle}`,
    `打包時間：${stamp(new Date().toISOString()).replace("_", " ")}（台北時間）`,
    `件數：${sorted.length}`,
    "",
    "序號\t時間（台北）\t類型\t檔名\t大小(KB)\tSHA-256\t備註",
  ];

  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i];
    const { data, error } = await supabase.storage.from(BUCKET).download(f.storagePath);
    if (error) throw error;
    const bytes = new Uint8Array(await data.arrayBuffer());
    const seq = String(i + 1).padStart(2, "0");
    const name = `${seq}_${stamp(f.capturedAt)}_${f.kind}_${safeName(f.fileName)}`;
    entries[name] = bytes;
    lines.push(
      [seq, stamp(f.capturedAt).replace("_", " "), f.kind, name, Math.ceil(f.sizeBytes / 1024), f.sha256, f.note.replace(/\s+/g, " ")].join("\t")
    );
  }

  lines.push(
    "",
    "說明：時間取自檔案的最後修改時間，使用者可自行修正；SHA-256 為上傳當下計算，可用來核對檔案未被更動。",
    "",
    EVIDENCE_DISCLAIMER
  );
  // 加 BOM，Windows 記事本與 Excel 才不會亂碼
  entries["00_清單與聲明.txt"] = strToU8("﻿" + lines.join("\r\n"));

  // 圖片、PDF 本身已壓縮，不再壓縮以節省時間
  const zipped = zipSync(entries, { level: 0 });
  return new Blob([zipped as BlobPart], { type: "application/zip" });
}
