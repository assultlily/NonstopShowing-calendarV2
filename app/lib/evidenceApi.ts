import { zipSync, strToU8 } from "fflate";
import { supabase } from "./supabaseClient";

// 消費爭議存證：檔案預設只存在使用者自己的裝置（瀏覽器 IndexedDB）。
// 使用者勾選同意後，才把副本暫存到雲端（Supabase），30 天到期。
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024; // 單檔 5MB
export const EVIDENCE_MAX_FILES = 30; // 每張活動卡最多 30 件
export const CLOUD_KEEP_DAYS = 30;
const BUCKET = "evidence";

export const EVIDENCE_KINDS = ["截圖", "照片", "票根", "PDF", "文字頁面"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_DISCLAIMER =
  "具體申訴對象與管道，請向演出發生地所在地方政府機關諮詢。本軟體所提資料皆由使用者自行登錄提供，僅作證據保全使用，不負擔任何法律上應由使用者證明之善良管理人之注意義務。";

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

export interface EvidenceMeta {
  id: string;
  userId: string;
  eventId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: EvidenceKind;
  capturedAt: string; // ISO
  sha256: string;
  note: string;
}

// 本機紀錄：含檔案本體；cloudExpiresAt 有值代表雲端有暫存副本
export interface EvidenceFile extends EvidenceMeta {
  blob: Blob;
  cloudExpiresAt: string | null;
}

// 雲端暫存副本（只有中繼資料，檔案本體要另外下載）
export interface CloudCopy extends EvidenceMeta {
  storagePath: string;
  expiresAt: string;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

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

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("請先登入");
  return uid;
}

/* ---------------- 本機儲存（IndexedDB） ---------------- */

const DB_NAME = "nonstop-evidence";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("這個瀏覽器不支援本機儲存（可能是無痕模式）"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("byEvent", ["userId", "eventId"]);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("無法開啟本機儲存"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("本機儲存失敗（空間可能不足）"));
    };
  });
}

const byTime = (a: { capturedAt: string }, b: { capturedAt: string }) =>
  a.capturedAt.localeCompare(b.capturedAt);

export async function listLocal(uid: string, eventId: string): Promise<EvidenceFile[]> {
  const rows = await withStore<EvidenceFile[]>("readonly", (s) =>
    s.index("byEvent").getAll([uid, eventId]) as IDBRequest<EvidenceFile[]>
  );
  return rows.sort(byTime);
}

async function putLocal(rec: EvidenceFile): Promise<void> {
  await withStore("readwrite", (s) => s.put(rec));
}

async function deleteLocal(id: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id));
}

export async function addEvidence(uid: string, eventId: string, file: File): Promise<EvidenceFile> {
  const problem = checkEvidenceFile(file);
  if (problem) throw new Error(problem);
  const buf = await file.arrayBuffer();
  const rec: EvidenceFile = {
    id: crypto.randomUUID(),
    userId: uid,
    eventId,
    fileName: file.name,
    mimeType: EXT_TO_MIME[extOf(file.name)],
    sizeBytes: file.size,
    kind: guessKind(file),
    // 檔案的最後修改時間通常就是截圖或拍照時間
    capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
    sha256: await sha256Hex(buf),
    note: "",
    blob: new Blob([buf], { type: EXT_TO_MIME[extOf(file.name)] }),
    cloudExpiresAt: null,
  };
  await putLocal(rec);
  return rec;
}

export async function updateEvidence(
  rec: EvidenceFile,
  patch: Partial<Pick<EvidenceMeta, "kind" | "capturedAt" | "note">>
): Promise<EvidenceFile> {
  const next = { ...rec, ...patch };
  await putLocal(next);
  if (rec.cloudExpiresAt) {
    const row: Record<string, string> = {};
    if (patch.kind) row.kind = patch.kind;
    if (patch.capturedAt) row.captured_at = patch.capturedAt;
    if (patch.note !== undefined) row.note = patch.note;
    await supabase.from("evidence_files").update(row).eq("id", rec.id);
  }
  return next;
}

// 刪除：本機與雲端副本一起刪
export async function removeEvidence(rec: EvidenceFile): Promise<void> {
  if (rec.cloudExpiresAt) await deleteCloudCopy(rec.id, cloudPath(rec));
  await deleteLocal(rec.id);
}

// 卡片永久刪除時：清掉這張卡在本機與雲端的所有存證，避免留下孤兒檔案
export async function purgeEvidenceForEvent(uid: string, eventId: string): Promise<number> {
  const local = await listLocal(uid, eventId);
  const { data, error } = await supabase
    .from("evidence_files")
    .select("id, storage_path")
    .eq("event_id", eventId);
  if (error) throw error;
  const cloud = (data || []) as { id: string; storage_path: string }[];
  for (const r of cloud) await deleteCloudCopy(r.id, r.storage_path);
  for (const rec of local) await deleteLocal(rec.id);
  return local.length;
}

// 計算某張卡在本機有幾件存證（刪除前提醒用）
export async function countLocalEvidence(uid: string, eventId: string): Promise<number> {
  return (await listLocal(uid, eventId)).length;
}

export function openEvidence(rec: EvidenceFile): void {
  const url = URL.createObjectURL(rec.blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* ---------------- 雲端暫存（需使用者同意） ---------------- */

const consentKey = (uid: string) => `evidence-cloud-consent:${uid}`;

export function getCloudConsent(uid: string): boolean {
  try {
    return !!localStorage.getItem(consentKey(uid));
  } catch {
    return false;
  }
}

export function setCloudConsent(uid: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(consentKey(uid), new Date().toISOString());
    else localStorage.removeItem(consentKey(uid));
  } catch {
    // 無法記住時，下次開啟會再詢問
  }
}

function cloudPath(rec: EvidenceMeta): string {
  return `${rec.userId}/${rec.eventId}/${rec.id}.${extOf(rec.fileName) || "bin"}`;
}

export async function backupToCloud(rec: EvidenceFile): Promise<EvidenceFile> {
  const path = cloudPath(rec);
  const up = await supabase.storage
    .from(BUCKET)
    .upload(path, rec.blob, { contentType: rec.mimeType, upsert: true });
  if (up.error) throw up.error;
  const expiresAt = new Date(Date.now() + CLOUD_KEEP_DAYS * 86400_000).toISOString();
  const { error } = await supabase.from("evidence_files").upsert({
    id: rec.id,
    event_id: rec.eventId,
    storage_path: path,
    file_name: rec.fileName,
    mime_type: rec.mimeType,
    size_bytes: rec.sizeBytes,
    kind: rec.kind,
    captured_at: rec.capturedAt,
    sha256: rec.sha256,
    note: rec.note,
    consented_at: new Date().toISOString(),
    expires_at: expiresAt,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  const next = { ...rec, cloudExpiresAt: expiresAt };
  await putLocal(next);
  return next;
}

async function deleteCloudCopy(id: string, path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
  await supabase.from("evidence_files").delete().eq("id", id);
}

type CloudRow = {
  id: string;
  user_id: string;
  event_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: EvidenceKind;
  captured_at: string;
  sha256: string;
  note: string;
  expires_at: string;
};

function rowToCloud(r: CloudRow): CloudCopy {
  return {
    id: r.id,
    userId: r.user_id,
    eventId: r.event_id,
    storagePath: r.storage_path,
    fileName: r.file_name,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    kind: r.kind,
    capturedAt: r.captured_at,
    sha256: r.sha256,
    note: r.note,
    expiresAt: r.expires_at,
  };
}

// 清掉自己已到期的雲端副本，回傳仍有效的副本
export async function listCloud(eventId: string): Promise<CloudCopy[]> {
  const { data, error } = await supabase
    .from("evidence_files")
    .select("*")
    .eq("event_id", eventId);
  if (error) throw error;
  const rows = (data || []).map((r) => rowToCloud(r as CloudRow));
  const now = new Date().toISOString();
  const expired = rows.filter((r) => r.expiresAt <= now);
  for (const r of expired) await deleteCloudCopy(r.id, r.storagePath);
  return rows.filter((r) => r.expiresAt > now);
}

// 從雲端取回到這台裝置
export async function restoreFromCloud(copy: CloudCopy): Promise<EvidenceFile> {
  const { data, error } = await supabase.storage.from(BUCKET).download(copy.storagePath);
  if (error) throw error;
  const rec: EvidenceFile = {
    id: copy.id,
    userId: copy.userId,
    eventId: copy.eventId,
    fileName: copy.fileName,
    mimeType: copy.mimeType,
    sizeBytes: copy.sizeBytes,
    kind: copy.kind,
    capturedAt: copy.capturedAt,
    sha256: copy.sha256,
    note: copy.note,
    blob: data,
    cloudExpiresAt: copy.expiresAt,
  };
  await putLocal(rec);
  return rec;
}

// 撤回同意：刪掉這個帳號在雲端的所有暫存副本，並把本機紀錄標成未備份
export async function withdrawCloudConsent(uid: string): Promise<number> {
  const { data, error } = await supabase.from("evidence_files").select("id, storage_path");
  if (error) throw error;
  const rows = (data || []) as { id: string; storage_path: string }[];
  for (const r of rows) await deleteCloudCopy(r.id, r.storage_path);
  setCloudConsent(uid, false);
  const all = await withStore<EvidenceFile[]>("readonly", (s) => s.getAll() as IDBRequest<EvidenceFile[]>);
  for (const rec of all) {
    if (rec.userId === uid && rec.cloudExpiresAt) await putLocal({ ...rec, cloudExpiresAt: null });
  }
  return rows.length;
}

/* ---------------- 一鍵打包 ---------------- */

function stamp(iso: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const t = new Date(new Date(iso).getTime() + 8 * 3600 * 1000); // 台北時間
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}_${p(
    t.getUTCHours()
  )}${p(t.getUTCMinutes())}`;
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|\n\r\t]/g, "_").slice(0, 60);
}

// 全部在本機完成：依時間排序、統一檔名、附清單與聲明
export async function packEvidence(eventTitle: string, files: EvidenceFile[]): Promise<Blob> {
  const sorted = [...files].sort(byTime);
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
    const seq = String(i + 1).padStart(2, "0");
    const name = `${seq}_${stamp(f.capturedAt)}_${f.kind}_${safeName(f.fileName)}`;
    entries[name] = new Uint8Array(await f.blob.arrayBuffer());
    lines.push(
      [seq, stamp(f.capturedAt).replace("_", " "), f.kind, name, Math.ceil(f.sizeBytes / 1024), f.sha256, f.note.replace(/\s+/g, " ")].join("\t")
    );
  }
  lines.push(
    "",
    "說明：時間取自檔案的最後修改時間，使用者可自行修正；SHA-256 為加入當下計算，可用來核對檔案未被更動。",
    "",
    EVIDENCE_DISCLAIMER
  );
  entries["00_清單與聲明.txt"] = strToU8("﻿" + lines.join("\r\n"));
  const zipped = zipSync(entries, { level: 0 });
  return new Blob([zipped as BlobPart], { type: "application/zip" });
}
