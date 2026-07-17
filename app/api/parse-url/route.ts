import { NextRequest, NextResponse } from "next/server";

// 從網頁原始碼裡抓 <meta property="xxx" content="..."> 或反過來的順序
// 用反向引用 (\1) 確保只在「同一種」引號結尾，避免內容裡剛好包含另一種引號字元時被提前截斷
function extractMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=(["'])((?:(?!\\1).)*)\\1`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=(["'])((?:(?!\\1).)*)\\1[^>]+property=["']${property}["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=(["'])((?:(?!\\1).)*)\\1`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match) return decodeHtmlEntities(match[2]);
  }
  return null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// 遞迴在 JSON-LD 資料裡尋找 @type 是 Event（或包含 Event）的物件
function findEventNode(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findEventNode(item);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    const typeStr = Array.isArray(type) ? type.join(",") : String(type || "");
    if (typeStr.toLowerCase().includes("event")) {
      return obj;
    }
    // 有些網站會把資料包在 @graph 陣列裡
    if (obj["@graph"]) {
      const found = findEventNode(obj["@graph"]);
      if (found) return found;
    }
  }
  return null;
}

// 抓網頁裡 <script type="application/ld+json"> 區塊，嘗試找出 schema.org Event 的 startDate
// 這是網站主動提供給搜尋引擎（例如 Google）看的結構化資料，格式固定，比從文字裡用規則猜日期準確很多
function extractEventStartDate(html: string): string | null {
  const scriptRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1].trim());
      const eventNode = findEventNode(json);
      const startDate = eventNode?.startDate;
      if (typeof startDate === "string" && startDate.length >= 10) {
        return startDate;
      }
    } catch {
      // 這段 JSON-LD 格式不合法或不是我們要的結構，略過繼續找下一段
      continue;
    }
  }
  return null;
}

// 把 ISO 8601 格式（例如 2026-12-31T19:00:00+09:00）轉成專案內部使用的 "YYYY-MM-DD HH:mm" 格式
function normalizeIsoDate(isoDate: string): string | null {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = body?.url;

    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json({ error: "缺少網址" }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "網址格式不正確" }, { status: 400 });
    }

    // 只允許 http/https，避免被拿來當作內部網路探測工具
    if (!["http:", "https:"].includes(target.protocol)) {
      return NextResponse.json(
        { error: "只支援 http / https 網址" },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let response: Response;
    try {
      response = await fetch(target.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      // 403 / 429 常見於防機器人保護擋下請求，給使用者明確一點的說明
      const isBotBlocked = response.status === 403 || response.status === 429;
      return NextResponse.json(
        {
          error: isBotBlocked
            ? "此網站有防機器人保護機制，暫時無法自動讀取內容，請手動輸入活動資訊"
            : `無法讀取此網址（狀態碼 ${response.status}）`,
        },
        { status: 502 }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "這個網址回傳的不是網頁內容，可能不是有效的活動頁面" },
        { status: 415 }
      );
    }

    // 避免抓到超大頁面拖垮效能，只讀取前 500KB
    const fullText = await response.text();
    const html = fullText.slice(0, 500_000);

    // 常見防機器人驗證頁面的關鍵字，抓到這些代表拿到的不是真正的活動頁面內容
    const botChallengeMarkers = [
      "Just a moment",
      "Attention Required",
      "cf-browser-verification",
      "captcha",
      "驗證您是真人",
      "請完成驗證",
    ];
    const looksLikeBotChallenge = botChallengeMarkers.some((marker) =>
      html.toLowerCase().includes(marker.toLowerCase())
    );
    if (looksLikeBotChallenge) {
      return NextResponse.json(
        {
          error:
            "此網站有防機器人驗證機制，暫時無法自動讀取內容，請手動輸入活動資訊",
        },
        { status: 502 }
      );
    }

    const ogTitle = extractMetaContent(html, "og:title");
    const ogDescription = extractMetaContent(html, "og:description");
    const ogImage = extractMetaContent(html, "og:image");

    const titleTagMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const titleTag = titleTagMatch
      ? decodeHtmlEntities(titleTagMatch[1].trim())
      : null;

    const rawStartDate = extractEventStartDate(html);
    const eventDate = rawStartDate ? normalizeIsoDate(rawStartDate) : null;

    return NextResponse.json({
      title: ogTitle || titleTag || null,
      description: ogDescription || null,
      image: ogImage || null,
      eventDate,
    });
  } catch (err) {
    console.error("parse-url API error:", err);
    const isAbort = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        error: isAbort
          ? "讀取網頁逾時，請稍後再試"
          : "讀取網頁時發生錯誤，請確認網址是否正確",
      },
      { status: 500 }
    );
  }
}
