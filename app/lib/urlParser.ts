export interface ParsedUrlInfo {
  title: string | null;
  description: string | null;
  image: string | null;
  eventDate: string | null;
}

// 呼叫後端 /api/parse-url，讓伺服器代替瀏覽器去抓網頁內容
// （瀏覽器端因為 CORS 限制，沒辦法直接抓別人網站的內容）
export async function parseUrlContent(url: string): Promise<ParsedUrlInfo> {
  const res = await fetch("/api/parse-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "讀取網頁內容失敗");
  }

  return res.json();
}
