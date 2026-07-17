import { NextRequest, NextResponse } from "next/server";

// 從網頁原始碼裡抓 <meta property="xxx" content="..."> 或反過來的順序
function extractMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match) return decodeHtmlEntities(match[1]);
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
            "Mozilla/5.0 (compatible; NonstopChallengerBot/1.0; +https://nonstop-showing-calendar-v2.vercel.app)",
          Accept: "text/html",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `無法讀取此網址（狀態碼 ${response.status}）` },
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

    const ogTitle = extractMetaContent(html, "og:title");
    const ogDescription = extractMetaContent(html, "og:description");
    const ogImage = extractMetaContent(html, "og:image");

    const titleTagMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const titleTag = titleTagMatch
      ? decodeHtmlEntities(titleTagMatch[1].trim())
      : null;

    return NextResponse.json({
      title: ogTitle || titleTag || null,
      description: ogDescription || null,
      image: ogImage || null,
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
