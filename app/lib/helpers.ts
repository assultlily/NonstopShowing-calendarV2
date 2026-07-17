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
  let q = "台北小巨蛋";
  if (locationName.includes("世運") || locationName.includes("高雄"))
    q = "高雄國家體育場";
  if (locationName.includes("理律")) q = "台北市信義區忠孝東路四段555號";
  if (locationName.includes("華山")) q = "華山1914文化創意產業園區";

  const query = encodeURIComponent(locationName || q);
  const url = `https://maps.google.com/maps?q=${query}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  // 確保輸出的 URL 只有 https 開頭，防止 iframe 注入
  return url.startsWith("https://") ? url : "about:blank";
}

export function formatGmtLabel(offset: number): string {
  if (offset === 0) return "GMT+0";
  return offset > 0 ? `GMT+${offset}` : `GMT${offset}`;
}

// 售票平台偵測系統：深度支持海外及台灣主流平台
export function identifyTicketPlatform(
  url: string
): { platform: string; color: string } | null {
  const lowercaseUrl = url.toLowerCase();

  // 1. 台灣主流平台
  if (lowercaseUrl.includes("tixcraft.com"))
    return { platform: "tixCraft 拓元售票", color: "text-rose-400" };
  if (lowercaseUrl.includes("kktix.cc") || lowercaseUrl.includes("kktix.com"))
    return { platform: "KKTIX 售票", color: "text-teal-400" };
  if (lowercaseUrl.includes("kham.com.tw"))
    return { platform: "KHAM 寬宏售票", color: "text-amber-400" };
  if (
    lowercaseUrl.includes("udnfunlife.com") ||
    lowercaseUrl.includes("udnticket")
  )
    return { platform: "udn 售票網", color: "text-blue-400" };
  if (
    lowercaseUrl.includes("famiticket.com.tw") ||
    lowercaseUrl.includes("famiport")
  )
    return { platform: "FamiTicket 全網購票", color: "text-green-400" };
  if (lowercaseUrl.includes("opentix.life"))
    return { platform: "OPENTIX 兩廳院文化生活", color: "text-cyan-400" };
  if (lowercaseUrl.includes("ticketplus.com.tw"))
    return { platform: "遠大售票", color: "text-emerald-400" };
  if (lowercaseUrl.includes("ticket.com.tw"))
    return { platform: "年代售票", color: "text-orange-400" };
  if (
    lowercaseUrl.includes("mna.com.tw") ||
    lowercaseUrl.includes("mnaticket.com.tw")
  )
    return { platform: "MNA 牛耳藝術", color: "text-yellow-600" };
  if (lowercaseUrl.includes("ibon.com.tw"))
    return { platform: "ibon 售票系統", color: "text-red-500" };

  // 2. 海外主流平台
  if (lowercaseUrl.includes("livenation"))
    return { platform: "Live Nation 理想國", color: "text-yellow-400" };
  if (lowercaseUrl.includes("ticketmaster"))
    return { platform: "Ticketmaster", color: "text-sky-400" };
  if (lowercaseUrl.includes("confetti-web.com"))
    return { platform: "Confetti 票務", color: "text-purple-400" };
  if (lowercaseUrl.includes("pia.jp"))
    return { platform: "Ticket Pia (ぴあ)", color: "text-indigo-400" };
  if (lowercaseUrl.includes("eplus.jp"))
    return { platform: "eplus (イープラス)", color: "text-pink-400" };

  return null;
}

// 產生「加入 Google 日曆」連結
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
