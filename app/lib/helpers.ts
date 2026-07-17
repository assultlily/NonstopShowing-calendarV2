// 純工具函式：不依賴任何 React 狀態，方便單獨測試與重複使用

// 把 "YYYY-MM-DD HH:mm" 格式的字串，依時區 offset 換算成 UTC 時間戳
export function getUtcTimestamp(timeStr: string, offset: number): number {
  try {
    const parts = timeStr.split(" ");
    const datePart = parts[0];
    const timePart = parts[1] || "12:00";
    const [year, month, day] = datePart.split("-").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);

    const date = new Date(year, month - 1, day, hours, minutes);
    return date.getTime() - offset * 60 * 60 * 1000;
  } catch (e) {
    return 0;
  }
}

export function getNavigationUrl(locationName: string): string {
  const base = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    locationName
  )}`;
  // 若是惡意開頭，強制導向 Google 首頁
  return base.startsWith("https://") ? base : "https://www.google.com";
}

export function getEmbedMapIframeUrl(locationName: string): string {
  const query = encodeURIComponent(locationName);
  const url = `https://maps.google.com/maps?q=${query}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  // 確保輸出的 URL 只有 https 開頭，防止 iframe 注入
  return url.startsWith("https://") ? url : "about:blank";
}

export function formatGmtLabel(offset: number): string {
  if (offset === 0) return "GMT+0";
  return offset > 0 ? `GMT+${offset}` : `GMT${offset}`;
}

// 售票平台偵測系統：深度支持海外及台灣主流平台
// defaultOffset：如果這個平台「只服務單一地區」（例如台灣、日本的售票網），可以放心直接給時區
// 像 Ticketmaster、Live Nation 這種全球性平台，場次可能在任何國家，這裡故意回傳 null，不亂猜
export function identifyTicketPlatform(url: string): {
  platform: string;
  color: string;
  defaultOffset: number | null;
} | null {
  const lowercaseUrl = url.toLowerCase();

  // 1. 台灣主流平台（GMT+8）
  if (lowercaseUrl.includes("tixcraft.com"))
    return {
      platform: "tixCraft 拓元售票",
      color: "text-rose-400",
      defaultOffset: 8,
    };
  if (lowercaseUrl.includes("kktix.cc") || lowercaseUrl.includes("kktix.com"))
    return { platform: "KKTIX 售票", color: "text-teal-400", defaultOffset: 8 };
  if (lowercaseUrl.includes("kham.com.tw"))
    return {
      platform: "KHAM 寬宏售票",
      color: "text-amber-400",
      defaultOffset: 8,
    };
  if (
    lowercaseUrl.includes("udnfunlife.com") ||
    lowercaseUrl.includes("udnticket")
  )
    return { platform: "udn 售票網", color: "text-blue-400", defaultOffset: 8 };
  if (
    lowercaseUrl.includes("famiticket.com.tw") ||
    lowercaseUrl.includes("famiport")
  )
    return {
      platform: "FamiTicket 全網購票",
      color: "text-green-400",
      defaultOffset: 8,
    };
  if (lowercaseUrl.includes("opentix.life"))
    return {
      platform: "OPENTIX 兩廳院文化生活",
      color: "text-cyan-400",
      defaultOffset: 8,
    };
  if (lowercaseUrl.includes("ticketplus.com.tw"))
    return {
      platform: "遠大售票",
      color: "text-emerald-400",
      defaultOffset: 8,
    };
  if (lowercaseUrl.includes("ticket.com.tw"))
    return {
      platform: "年代售票",
      color: "text-orange-400",
      defaultOffset: 8,
    };
  if (
    lowercaseUrl.includes("mna.com.tw") ||
    lowercaseUrl.includes("mnaticket.com.tw")
  )
    return {
      platform: "MNA 牛耳藝術",
      color: "text-yellow-600",
      defaultOffset: 8,
    };
  if (lowercaseUrl.includes("ibon.com.tw"))
    return {
      platform: "ibon 售票系統",
      color: "text-red-500",
      defaultOffset: 8,
    };

  // 2. 海外主流平台
  // Live Nation / Ticketmaster 是全球性平台，場次可能在世界各地，不猜時區
  if (lowercaseUrl.includes("livenation"))
    return {
      platform: "Live Nation 理想國",
      color: "text-yellow-400",
      defaultOffset: null,
    };
  if (lowercaseUrl.includes("ticketmaster"))
    return { platform: "Ticketmaster", color: "text-sky-400", defaultOffset: null };
  // 以下這幾個是專門服務日本地區的售票網，可以放心給 GMT+9
  if (lowercaseUrl.includes("confetti-web.com"))
    return {
      platform: "Confetti 票務",
      color: "text-purple-400",
      defaultOffset: 9,
    };
  if (lowercaseUrl.includes("pia.jp"))
    return {
      platform: "Ticket Pia (ぴあ)",
      color: "text-indigo-400",
      defaultOffset: 9,
    };
  if (lowercaseUrl.includes("eplus.jp"))
    return {
      platform: "eplus (イープラス)",
      color: "text-pink-400",
      defaultOffset: 9,
    };

  return null;
}

// 國家（代碼或英文名稱）→ 大致時區的對照表
// 注意：美國、加拿大、澳洲、俄羅斯這類橫跨多時區的國家，這裡只能給一個「常見代表時區」的粗略猜測
// 不保證每個場次都準，仍建議使用者自行確認
const COUNTRY_OFFSET_MAP: Record<string, number> = {
  jp: 9,
  jpn: 9,
  japan: 9,
  tw: 8,
  twn: 8,
  taiwan: 8,
  hk: 8,
  hkg: 8,
  "hong kong": 8,
  cn: 8,
  chn: 8,
  china: 8,
  kr: 9,
  kor: 9,
  "south korea": 9,
  korea: 9,
  sg: 8,
  sgp: 8,
  singapore: 8,
  th: 7,
  tha: 7,
  thailand: 7,
  vn: 7,
  vnm: 7,
  vietnam: 7,
  ph: 8,
  phl: 8,
  philippines: 8,
  my: 8,
  mys: 8,
  malaysia: 8,
  id: 7,
  idn: 7,
  indonesia: 7,
  us: -5, // 代表美東；美國實際橫跨多個時區，僅供參考
  usa: -5,
  "united states": -5,
  ca: -5, // 代表加東；加拿大同樣橫跨多時區
  can: -5,
  canada: -5,
  gb: 0,
  gbr: 0,
  uk: 0,
  "united kingdom": 0,
  fr: 1,
  fra: 1,
  france: 1,
  de: 1,
  deu: 1,
  germany: 1,
  it: 1,
  ita: 1,
  italy: 1,
  es: 1,
  esp: 1,
  spain: 1,
  nl: 1,
  nld: 1,
  netherlands: 1,
  be: 1,
  bel: 1,
  belgium: 1,
  ch: 1,
  che: 1,
  switzerland: 1,
  at: 1,
  aut: 1,
  austria: 1,
  se: 1,
  swe: 1,
  sweden: 1,
  no: 1,
  nor: 1,
  norway: 1,
  dk: 1,
  dnk: 1,
  denmark: 1,
  pl: 1,
  pol: 1,
  poland: 1,
  au: 10, // 代表雪梨；澳洲同樣橫跨多時區
  aus: 10,
  australia: 10,
  nz: 12,
  nzl: 12,
  "new zealand": 12,
};

// 把地址資料裡的國家欄位（可能是代碼或全名）轉換成時區 offset，對不到就回傳 null
export function getOffsetFromCountry(country: string | null): number | null {
  if (!country) return null;
  const key = country.trim().toLowerCase();
  return COUNTRY_OFFSET_MAP[key] ?? null;
}

// 活動狀態徽章（狀態本身固定，不隨語系變動，因此可以是靜態常數）
export const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  watchlist: {
    label: "👀 觀察中",
    color: "bg-slate-800 text-slate-300 border-slate-700",
  },
  applied_drawing: {
    label: "🗳️ 已登記抽選",
    color: "bg-blue-950/50 text-blue-400 border-blue-800",
  },
  purchased: {
    label: "🎟️ 購入完成",
    color: "bg-emerald-950/50 text-emerald-400 border-emerald-800",
  },
  ticket_splitting: {
    label: "📲 電子票分票中",
    color: "bg-indigo-950/50 text-indigo-400 border-indigo-800",
  },
  waiting_list: {
    label: "⏳ 等待候補中",
    color: "bg-amber-950/50 text-amber-400 border-amber-800",
  },
  ended_no_ticket: {
    label: "❌ 遺憾落選",
    color: "bg-rose-950/50 text-rose-400 border-rose-900",
  },
};

// 把 "YYYY-MM-DD HH:mm" 轉成 <input type="datetime-local"> 需要的 "YYYY-MM-DDTHH:mm"
export function showDateToInputValue(showDate: string): string {
  const parts = showDate.split(" ");
  const datePart = parts[0] || "";
  const timePart = parts[1] || "12:00";
  return `${datePart}T${timePart}`;
}

// 把 <input type="datetime-local"> 的值轉回原本使用的 "YYYY-MM-DD HH:mm" 格式
export function inputValueToShowDate(inputValue: string): string {
  const [datePart, timePart] = inputValue.split("T");
  return `${datePart} ${timePart || "12:00"}`;
}

// 嘗試從一段文字裡找出日期（常見格式：2026-12-31、2026/12/31、2026年12月31日）
// 找得到就一併嘗試抓時間（HH:mm），找不到時間就給預設的晚上7點
export function extractDateFromText(text: string): string | null {
  const dateMatch = text.match(/(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})日?/);
  if (!dateMatch) return null;

  const [, year, month, day] = dateMatch;
  const pad = (n: string) => n.padStart(2, "0");

  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  const time = timeMatch ? `${pad(timeMatch[1])}:${timeMatch[2]}` : "19:00";

  return `${year}-${pad(month)}-${pad(day)} ${time}`;
}

export function getGoogleCalendarLink(
  title: string,
  dateStr: string,
  details: string
): string {
  let cleanDate = "";
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charAt(i);
    if (char >= "0" && char <= "9") {
      cleanDate += char;
    }
  }

  const dateFormatted =
    cleanDate.length >= 8 ? cleanDate.substring(0, 8) : "20261231";
  const startTime =
    cleanDate.length >= 12
      ? cleanDate.substring(0, 12)
      : `${dateFormatted}T120000`;
  const endTime =
    cleanDate.length >= 12
      ? `${cleanDate.substring(0, 8)}T${(
          parseInt(cleanDate.substring(8, 10)) + 3
        )
          .toString()
          .padStart(2, "0")}${cleanDate.substring(10, 12)}`
      : `${dateFormatted}T150000`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${startTime}/${endTime}&details=${encodeURIComponent(details)}`;
}
