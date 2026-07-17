import { useState } from "react";
import { ShowEvent } from "../mockEvents";
import { identifyTicketPlatform, extractDateFromText } from "../lib/helpers";
import { syncEvents } from "../lib/eventsApi";
import { parseUrlContent } from "../lib/urlParser";

interface TicketSplit {
  total: number;
  split: number;
}

interface UseAiInputProcessorParams {
  events: ShowEvent[];
  setEvents: (events: ShowEvent[]) => void;
  ticketSplits: Record<string, TicketSplit>;
  setTicketSplits: (splits: Record<string, TicketSplit>) => void;
  eventOffsets: Record<string, number>;
  previousEvents: ShowEvent[] | null;
  setPreviousEvents: (events: ShowEvent[]) => void;
  setPreviousSplits: (splits: Record<string, TicketSplit>) => void;
  setPreviousOffsets: (offsets: Record<string, number>) => void;
  setReleasedAmount: (amount: number | null) => void;
  triggerUndo: () => void;
  setAiNotice: (msg: string) => void;
}

export function useAiInputProcessor({
  events,
  setEvents,
  ticketSplits,
  setTicketSplits,
  eventOffsets,
  previousEvents,
  setPreviousEvents,
  setPreviousSplits,
  setPreviousOffsets,
  setReleasedAmount,
  triggerUndo,
  setAiNotice,
}: UseAiInputProcessorParams) {
  const [aiInput, setAiInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // 新增卡片時共用的快照與雲端同步邏輯
  const addNewEvent = (newEvent: ShowEvent) => {
    setPreviousEvents([...events]);
    setPreviousSplits({ ...ticketSplits });
    setPreviousOffsets({ ...eventOffsets });

    const oldEventsSnapshot = events;
    const finalEvents = [newEvent, ...events];
    setEvents(finalEvents);
    syncEvents(finalEvents, oldEventsSnapshot).catch((err) => {
      console.error("同步雲端失敗：", err);
      setAiNotice("⚠️ 卡片已建立在畫面上，但同步到雲端失敗，請檢查網路連線。");
    });
  };

  const handleProcessAiInput = async (rawInput: string) => {
    // --- 資安注入：強行過濾任何惡意 Script ---
    const sanitized = rawInput
      .replace(/<[^>]*>?/gm, "")
      .replace(/javascript:/gi, "");
    if (sanitized !== rawInput) {
      setAiNotice("⚠️ 已自動偵測並過濾潛在不安全字元。");
      return;
    }
    const cleanInput = sanitized.trim();
    if (!cleanInput) return;

    const text = cleanInput.toLowerCase();

    // 網址智慧辨識建卡系統
    // 允許使用者貼上沒有 http(s):// 開頭的網址（例如從分享功能複製出來的網址常常會被拿掉協議）
    const looksLikeUrl =
      text.startsWith("http://") ||
      text.startsWith("https://") ||
      /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(
        cleanInput.split(/\s+/)[0]
      );

    if (looksLikeUrl) {
      // 若使用者沒帶協議，統一補上 https:// 以確保後續連結可正常開啟、平台比對邏輯一致
      const normalizedUrl = /^https?:\/\//i.test(cleanInput)
        ? cleanInput
        : `https://${cleanInput}`;

      const match = identifyTicketPlatform(normalizedUrl);
      const agencyGuess = match ? match.platform : "外部網站連結專案";
      const isKnownPlatform = !!match;

      setIsProcessing(true);
      setAiNotice("🔍 正在讀取網頁內容，請稍候...");

      let realTitle: string | null = null;
      let realDescription: string | null = null;
      let fetchFailed = false;

      try {
        const parsed = await parseUrlContent(normalizedUrl);
        realTitle = parsed.title;
        realDescription = parsed.description;
      } catch (err) {
        console.error("讀取網址內容失敗：", err);
        fetchFailed = true;
      }

      // 有抓到真實標題就優先使用，抓不到才退回用網址路徑猜
      let guessedTitle: string;
      if (realTitle) {
        guessedTitle =
          realTitle.length > 40 ? realTitle.slice(0, 37) + "..." : realTitle;
      } else {
        const urlParts = cleanInput.split("/");
        guessedTitle =
          urlParts[urlParts.length - 1] ||
          urlParts[urlParts.length - 2] ||
          "未命名網址匯入活動";
        if (guessedTitle.length > 25)
          guessedTitle = guessedTitle.substring(0, 22) + "...";
        guessedTitle = `🌐 網址：${guessedTitle.toUpperCase()}`;
      }

      // 嘗試從抓到的描述文字裡找日期，找不到才用預設值（且會提示使用者手動確認）
      const extractedDate = realDescription
        ? extractDateFromText(realDescription)
        : null;
      const showDate = extractedDate || "2026-12-31 19:00";

      const statusNote = fetchFailed
        ? "⚠️ 讀取網頁內容失敗（可能是網路問題或該網站不允許存取），已建立基本卡片，請手動補齊資訊。"
        : extractedDate
        ? "✅ 已從網頁內容中偵測到日期，請展開卡片確認是否正確。"
        : "⚠️ 已抓到網頁標題，但沒有偵測到明確日期，請展開卡片點擊時間欄位手動設定。";

      const fallbackNotes = `【📬 網址自動化偵測建立】\n${statusNote}\n原始網址：${cleanInput}\n${
        realDescription ? `\n網頁描述：${realDescription.slice(0, 200)}` : ""
      }\n\n請展開本卡片，自由修改隨手備忘、設定時區、或手動更動確切的演出時間。`;

      const newUrlEvent: ShowEvent = {
        id: `url-event-${Date.now()}`,
        title: guessedTitle,
        artist: "隨網址自動辨識建構",
        type: "official",
        location:
          text.includes("eplus") ||
          text.includes("pia.jp") ||
          text.includes("confetti")
            ? "日本現地會場"
            : "未指定地點 (請展開本卡片手動微調)",
        showDate,
        agency: agencyGuess,
        sourceUrl: normalizedUrl,
        statusLifecycle: "watchlist",
        userNotes: fallbackNotes,
        expenses: [{ item: "預估票規費項目", cost: 0 }],
        ticketStages: [
          {
            stageName: "網址情報源已鎖定",
            saleTime: "即日起",
            status: "active",
          },
          {
            stageName: "使用者自訂管制點",
            saleTime: `${showDate.split(" ")[0]} 12:00`,
            status: "active",
          },
        ],
        fanEvents: [],
        curatedShops: [],
      };

      addNewEvent(newUrlEvent);
      setIsProcessing(false);

      setAiNotice(
        fetchFailed
          ? `⚠️ [網址已匯入，但讀取失敗]：\n已建立基本卡片，請手動補上正確資訊。`
          : isKnownPlatform
          ? `🎉 [網址自動辨識成功]：\n系統已為此連結【${agencyGuess}】建構專屬卡片，標題${
              realTitle ? "已自動抓取" : "未抓到，請手動確認"
            }！`
          : `ℹ️ [通用網址已匯入]：\n已為您建置連結專案，請手動確認售票平台與時間！`
      );
      setAiInput("");
      return;
    }

    // 復原指令
    if (text === "復原" || text === "上一步" || text === "undo") {
      if (previousEvents) {
        triggerUndo();
        setAiInput("");
      } else {
        setAiNotice("⚠️ 目前沒有更早的歷史紀錄可以復原。");
        setAiInput("");
      }
      return;
    }

    // 新增活動指令
    if (
      text.startsWith("新建:") ||
      text.startsWith("新建：") ||
      text.startsWith("add:")
    ) {
      const cleanText = cleanInput.substring(3).trim();
      const parts = cleanText.split(/[,，]/);

      if (parts.length >= 1 && parts[0].trim() !== "") {
        const title = parts[0].trim();
        const artist = parts[1] ? parts[1].trim() : "未指定藝人/主辦";
        const showDate = parts[2] ? parts[2].trim() : "2026-12-31 18:00";
        const location = parts[3] ? parts[3].trim() : "未指定地點";

        const newEvent: ShowEvent = {
          id: `dynamic-event-${Date.now()}`,
          title: title,
          artist: artist,
          type:
            title.includes("研討會") || title.includes("講座")
              ? "seminar"
              : "official",
          location: location,
          showDate: showDate,
          agency: "AI 動態生成專案",
          sourceUrl: "https://ticketplus.com.tw",
          statusLifecycle: "applied_drawing",
          userNotes: "此活動為打字動態自動生成。可自由輸入修改備忘錄。",
          expenses: [{ item: "預估票面費", cost: 3600 }],
          ticketStages: [
            { stageName: "系統開放登記", saleTime: "即日起", status: "ended" },
            {
              stageName: "抽選公佈與付費",
              saleTime: `${showDate.split(" ")[0]} 12:00`,
              status: "drawing",
            },
          ],
          fanEvents: [],
          curatedShops: [],
        };

        addNewEvent(newEvent);

        const updatedSplits = {
          ...ticketSplits,
          [newEvent.id]: { total: 1, split: 0 },
        };
        setTicketSplits(updatedSplits);
        localStorage.setItem(
          "nonstop_challenger_splits",
          JSON.stringify(updatedSplits)
        );

        setAiNotice(`✨ [AI 動態建構成功]：\n已成功新增【${title}】！`);
        setAiInput("");
        return;
      }
    }

    // 智慧語意狀態更新系統
    let updatedEvents = [...events];
    const noticeMessages: string[] = [];

    const isNegative =
      text.includes("沒") ||
      text.includes("無") ||
      text.includes("不") ||
      text.includes("未") ||
      text.includes("敗") ||
      text.includes("落選");

    if (text.includes("優里") || text.includes("yuuri")) {
      if (
        (text.includes("中選") ||
          text.includes("買到") ||
          text.includes("中票")) &&
        !isNegative
      ) {
        updatedEvents = updatedEvents.map((event) =>
          event.id === "event-yuuri-004"
            ? { ...event, statusLifecycle: "purchased" }
            : event
        );
        noticeMessages.push(
          "🎟️ 已將【優里】狀態更新為【購入完成】！資金已從預備金正式扣減。"
        );
      } else if (
        isNegative &&
        (text.includes("沒") ||
          text.includes("落選") ||
          text.includes("未中選"))
      ) {
        const targetEvent = events.find((e) => e.id === "event-yuuri-004");
        if (
          targetEvent &&
          (targetEvent.statusLifecycle === "applied_drawing" ||
            targetEvent.statusLifecycle === "waiting_list")
        ) {
          const cost = targetEvent.expenses.reduce(
            (sum, exp) => sum + exp.cost,
            0
          );
          setReleasedAmount(cost);
          setTimeout(() => setReleasedAmount(null), 5000);
        }

        updatedEvents = updatedEvents.map((event) =>
          event.id === "event-yuuri-004"
            ? { ...event, statusLifecycle: "ended_no_ticket" }
            : event
        );
        noticeMessages.push("😢 偵測到優里落選，已設為【遺憾落選】。");
      }
    }

    if (noticeMessages.length > 0) {
      setPreviousEvents([...events]);
      setPreviousSplits({ ...ticketSplits });
      setPreviousOffsets({ ...eventOffsets });

      const oldEventsSnapshot = events;
      setEvents(updatedEvents);
      syncEvents(updatedEvents, oldEventsSnapshot).catch((err) => {
        console.error("同步雲端失敗：", err);
        setAiNotice("⚠️ 狀態已更新在畫面上，但同步到雲端失敗，請檢查網路連線。");
      });
      setAiNotice(`⚡ AI 語意分析連動成功：\n${noticeMessages.join("\n")}`);
      setAiInput("");
    } else {
      setAiNotice(
        `💡 系統已收到您的感測指令：\n"${cleanInput}"\n※ 貼上售票網址、或使用「新建:」公式，按下 Enter 即可自動建構！`
      );
      setAiInput("");
    }
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleProcessAiInput(aiInput);
    }
  };

  return {
    aiInput,
    setAiInput,
    isProcessing,
    handleProcessAiInput,
    handleKeyDownInput,
  };
}
