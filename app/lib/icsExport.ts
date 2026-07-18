import { ShowEvent } from "../mockEvents";
import { getUtcTimestamp } from "./helpers";

// 把時間戳格式化成 .ics 標準格式（UTC）：YYYYMMDDTHHMMSSZ
function formatIcsDate(timestampMs: number): string {
  const d = new Date(timestampMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
    d.getUTCDate()
  )}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(
    d.getUTCSeconds()
  )}Z`;
}

// 把文字裡容易讓 .ics 格式跑掉的字元跳脫掉
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// 產生標準 .ics 行事曆檔案內容，Google 日曆／Apple 日曆／Outlook 都能直接匯入
export function generateIcsContent(
  events: ShowEvent[],
  eventOffsets: Record<string, number>,
  browserOffset: number
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nonstop Challenger//Calendar Export//ZH",
    "CALSCALE:GREGORIAN",
  ];

  events.forEach((event) => {
    const offset =
      eventOffsets[event.id] !== undefined
        ? eventOffsets[event.id]
        : browserOffset;
    const startMs = getUtcTimestamp(event.showDate, offset);
    const endMs = startMs + 3 * 60 * 60 * 1000; // 預設抓 3 小時場次長度

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@nonstop-challenger`,
      `DTSTAMP:${formatIcsDate(Date.now())}`,
      `DTSTART:${formatIcsDate(startMs)}`,
      `DTEND:${formatIcsDate(endMs)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `LOCATION:${escapeIcsText(event.location)}`,
      `DESCRIPTION:${escapeIcsText(
        `主辦／情報源：${event.agency}\\n原始網址：${event.sourceUrl}`
      )}`,
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// 觸發瀏覽器下載 .ics 檔案
export function downloadIcsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
