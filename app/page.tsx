"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  mockEvents as initialMockEvents,
  ShowEvent,
  TicketStage,
} from "./mockEvents";
import {
  Calendar,
  List,
  Search,
  Layers,
  ShieldCheck,
  DollarSign,
  MapPin,
  ExternalLink,
  Bookmark,
  Users,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  PlusCircle,
  AlertTriangle,
  TrendingUp,
  Download,
  Upload,
  RotateCcw,
  Globe,
  Wifi,
  CheckCircle2,
  Star,
  Shield,
  Navigation,
  Map,
} from "lucide-react";

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<"show" | "ticket">("show");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // 核心狀態
  const [events, setEvents] = useState<ShowEvent[]>([]);
  const [aiInput, setAiInput] = useState<string>("");
  const [aiNotice, setAiNotice] = useState<string>("");

  // 分票與主備案狀態
  const [ticketSplits, setTicketSplits] = useState<
    Record<string, { total: number; split: number }>
  >({});
  const [eventRoles, setEventRoles] = useState<
    Record<string, "primary" | "backup">
  >({});

  // 【全球時區】
  const [eventOffsets, setEventOffsets] = useState<Record<string, number>>({});
  const [browserOffset, setBrowserOffset] = useState<number>(8);

  // 資金釋放動態特效狀態
  const [releasedAmount, setReleasedAmount] = useState<number | null>(null);

  // 復原系統快照
  const [previousEvents, setPreviousEvents] = useState<ShowEvent[] | null>(
    null
  );
  const [previousSplits, setPreviousSplits] = useState<Record<
    string,
    { total: number; split: number }
  > | null>(null);
  const [previousRoles, setPreviousRoles] = useState<Record<
    string,
    "primary" | "backup"
  > | null>(null);
  const [previousOffsets, setPreviousOffsets] = useState<Record<
    string,
    number
  > | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化載入資料與瀏覽器時區偵測
  useEffect(() => {
    const localOffset = -new Date().getTimezoneOffset() / 60;
    setBrowserOffset(localOffset);

    const savedEvents = localStorage.getItem("nonstop_challenger_events");
    const savedSplits = localStorage.getItem("nonstop_challenger_splits");
    const savedRoles = localStorage.getItem("nonstop_challenger_roles");
    const savedOffsets = localStorage.getItem("nonstop_challenger_offsets");

    if (savedEvents) {
      try {
        setEvents(JSON.parse(savedEvents));
      } catch (e) {
        setEvents(initialMockEvents);
      }
    } else {
      setEvents(initialMockEvents);
    }

    if (savedSplits) {
      try {
        setTicketSplits(JSON.parse(savedSplits));
      } catch (e) {
        setTicketSplits({ "event-yuuri-004": { total: 4, split: 2 } });
      }
    } else {
      setTicketSplits({ "event-yuuri-004": { total: 4, split: 2 } });
    }

    if (savedRoles) {
      try {
        setEventRoles(JSON.parse(savedRoles));
      } catch (e) {
        setEventRoles({});
      }
    }

    if (savedOffsets) {
      try {
        setEventOffsets(JSON.parse(savedOffsets));
      } catch (e) {
        setEventOffsets({ "event-yuuri-004": 9, "event-fujii-kaze-002": 8 });
      }
    } else {
      setEventOffsets({ "event-yuuri-004": 9, "event-fujii-kaze-002": 8 });
    }
  }, []);

  // 鍵盤快速鍵監聽 (Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (previousEvents) {
          e.preventDefault();
          triggerUndo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previousEvents, previousSplits, previousRoles, previousOffsets]);

  // 儲存至 LocalStorage
  const saveEventsToStorage = (newEvents: ShowEvent[], takeSnapshot = true) => {
    if (takeSnapshot) {
      setPreviousEvents([...events]);
      setPreviousRoles({ ...eventRoles });
      setPreviousOffsets({ ...eventOffsets });
    }
    setEvents(newEvents);
    localStorage.setItem(
      "nonstop_challenger_events",
      JSON.stringify(newEvents)
    );
  };

  const saveSplitsToStorage = (
    newSplits: Record<string, { total: number; split: number }>,
    takeSnapshot = true
  ) => {
    if (takeSnapshot) {
      setPreviousSplits({ ...ticketSplits });
    }
    setTicketSplits(newSplits);
    localStorage.setItem(
      "nonstop_challenger_splits",
      JSON.stringify(newSplits)
    );
  };

  const saveRolesToStorage = (
    newRoles: Record<string, "primary" | "backup">
  ) => {
    setPreviousRoles({ ...eventRoles });
    setEventRoles(newRoles);
    localStorage.setItem("nonstop_challenger_roles", JSON.stringify(newRoles));
  };

  const saveOffsetsToStorage = (newOffsets: Record<string, number>) => {
    setPreviousOffsets({ ...eventOffsets });
    setEventOffsets(newOffsets);
    localStorage.setItem(
      "nonstop_challenger_offsets",
      JSON.stringify(newOffsets)
    );
  };

  // 執行復原
  const triggerUndo = () => {
    if (!previousEvents) return;
    const currentEvents = [...events];
    const currentSplits = { ...ticketSplits };
    const currentRoles = { ...eventRoles };
    const currentOffsets = { ...eventOffsets };

    setEvents(previousEvents);
    localStorage.setItem(
      "nonstop_challenger_events",
      JSON.stringify(previousEvents)
    );

    if (previousSplits) {
      setTicketSplits(previousSplits);
      localStorage.setItem(
        "nonstop_challenger_splits",
        JSON.stringify(previousSplits)
      );
    }
    if (previousRoles) {
      setEventRoles(previousRoles);
      localStorage.setItem(
        "nonstop_challenger_roles",
        JSON.stringify(previousRoles)
      );
    }
    if (previousOffsets) {
      setEventOffsets(previousOffsets);
      localStorage.setItem(
        "nonstop_challenger_offsets",
        JSON.stringify(previousOffsets)
      );
    }

    setPreviousEvents(currentEvents);
    setPreviousSplits(currentSplits);
    setPreviousRoles(currentRoles);
    setPreviousOffsets(currentOffsets);

    setAiNotice("↩️ 已成功復原至上一步！");
  };

  // 【全球時區換算】
  const convertToUserLocalTime = (
    venueTimeStr: string,
    venueOffset: number
  ) => {
    try {
      const parts = venueTimeStr.split(" ");
      const datePart = parts[0];
      const timePart = parts[1] || "12:00";

      const [year, month, day] = datePart.split("-").map(Number);
      const [hours, minutes] = timePart.split(":").map(Number);

      const date = new Date(year, month - 1, day, hours, minutes);
      const diffHours = browserOffset - venueOffset;
      date.setHours(date.getHours() + diffHours);

      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } catch (e) {
      return "時區計算錯誤";
    }
  };

  // 輔助函式：時區絕對毫秒戳記
  const getUtcTimestamp = (timeStr: string, offset: number) => {
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
  };

  // 【精準防撞偵測】
  // [微調 1]：優化為同天（24小時）內即判定衝突
  const getConflictingEvents = (currentEvent: ShowEvent) => {
    const currentOffset =
      eventOffsets[currentEvent.id] !== undefined
        ? eventOffsets[currentEvent.id]
        : browserOffset;
    const currentUtc = getUtcTimestamp(currentEvent.showDate, currentOffset);

    return events.filter((e) => {
      if (e.id === currentEvent.id) return false;
      const eOffset =
        eventOffsets[e.id] !== undefined ? eventOffsets[e.id] : browserOffset;
      const eUtc = getUtcTimestamp(e.showDate, eOffset);

      // 計算時間差（絕對值）
      const diffMs = Math.abs(currentUtc - eUtc);
      const hoursDiff = diffMs / (1000 * 60 * 60);

      // 若相差在 24 小時內，視為潛在時間衝突
      return hoursDiff < 24;
    });
  };

  // 【地圖服務】導航連結
  const getNavigationUrl = (locationName: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      locationName
    )}`;
  };

  // 【地圖服務】嵌入地圖
  const getEmbedMapIframeUrl = (locationName: string) => {
    let q = "台北小巨蛋";
    if (locationName.includes("世運") || locationName.includes("高雄"))
      q = "高雄國家體育場";
    if (locationName.includes("理律")) q = "台北市信義區忠孝東路四段555號";
    if (locationName.includes("華山")) q = "華山1914文化創意產業園區";

    const query = encodeURIComponent(locationName || q);
    return `https://maps.google.com/maps?q=${query}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  };

  const formatGmtLabel = (offset: number) => {
    if (offset === 0) return "GMT+0";
    return offset > 0 ? `GMT+${offset}` : `GMT${offset}`;
  };

  // 一鍵備份導出
  const exportData = () => {
    const backupData = {
      events: events,
      ticketSplits: ticketSplits,
      eventRoles: eventRoles,
      eventOffsets: eventOffsets,
      version: "5.1-ActionBasedAI",
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `NonstopChallenger_Backup_${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 一鍵備份導入
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.events && Array.isArray(imported.events)) {
          saveEventsToStorage(imported.events);
          if (imported.ticketSplits) saveSplitsToStorage(imported.ticketSplits);
          if (imported.eventRoles) setEventRoles(imported.eventRoles);
          if (imported.eventOffsets) setEventOffsets(imported.eventOffsets);
          alert("🎉 資料備份導入成功！");
        } else {
          alert("❌ 錯誤：這不是一個有效的 Nonstop Challenger 備份檔案格式。");
        }
      } catch (err) {
        alert("❌ 讀取檔案失敗，請確保檔案格式為正確的 JSON。");
      }
    };
    reader.readAsText(file);
  };

  // 【全新改版：主動感測核心邏輯】
  // 當按下 Enter 或點擊「智慧感測」按鈕時觸發，100% 避開搶跑與時序同步問題
  const handleProcessAiInput = (rawInput: string) => {
    const cleanInput = rawInput.trim();
    if (!cleanInput) return;

    const text = cleanInput.toLowerCase();
    let updatedEvents = [...events];
    let noticeMessages: string[] = [];

    // --- 1. 網址智慧辨識建卡系統 (擴充多售票平台自動辨識) ---
    if (text.startsWith("http://") || text.startsWith("https://")) {
      let agencyGuess = "外部網站連結專案";
      let isKnownPlatform = false;

      // [微調 2]：支援網址自動辨識 fallback UI
      if (text.includes("tixcraft")) {
        agencyGuess = "拓元售票系統 (tixCraft)";
        isKnownPlatform = true;
      } else if (text.includes("kktix")) {
        agencyGuess = "KKTIX 售票平台";
        isKnownPlatform = true;
      } else if (text.includes("ticketplus")) {
        agencyGuess = "Ticket Plus 遠大售票";
        isKnownPlatform = true;
      } else if (text.includes("eplus")) {
        agencyGuess = "日本 eplus 抽選網";
        isKnownPlatform = true;
      } else if (text.includes("ibon")) {
        agencyGuess = "ibon 售票系統";
        isKnownPlatform = true;
      } else if (text.includes("udnfunlife") || text.includes("udnticket")) {
        agencyGuess = "udn 售票網";
        isKnownPlatform = true;
      } else if (text.includes("famiticket") || text.includes("famiport")) {
        agencyGuess = "FamiTicket 全網購票網";
        isKnownPlatform = true;
      } else if (text.includes("pia.jp")) {
        agencyGuess = "日本 Ticket Pia";
        isKnownPlatform = true;
      } else if (text.includes("l-tike") || text.includes("lawson")) {
        agencyGuess = "日本 Lawson Ticket";
        isKnownPlatform = true;
      }

      const urlParts = cleanInput.split("/");
      let guessedTitle =
        urlParts[urlParts.length - 1] ||
        urlParts[urlParts.length - 2] ||
        "未命名網址匯入活動";
      if (guessedTitle.length > 25)
        guessedTitle = guessedTitle.substring(0, 22) + "...";
      guessedTitle = `🌐 網址：${guessedTitle.toUpperCase()}`;

      // 建立 Fallback 備註
      const fallbackNotes = isKnownPlatform
        ? `【📬 網址自動化偵測建立】\n本活動是由您直接貼上外部連結智慧生成的基底卡片！\n原始網址：${cleanInput}\n\n請展開本卡片，自由修改隨手備忘、設定時區、或手動更動確切的演出時間。`
        : `【📬 通用網址匯入（未辨識售票平台）】\n系統無法確認此網址所屬的購票平台，已為您建立通用連結專案。\n原始網址：${cleanInput}\n\n請展開此卡片手動微調會場名稱、更正售票平台名稱或時區設定。`;

      const newUrlEvent: ShowEvent = {
        id: `url-event-${Date.now()}`,
        title: guessedTitle,
        artist: "隨網址自動辨識建構",
        type: "official",
        location:
          text.includes("eplus") ||
          text.includes("pia.jp") ||
          text.includes("l-tike")
            ? "日本現地會場"
            : "未指定地點 (請展開本卡片手動微調)",
        showDate: "2026-12-31 19:00",
        agency: isKnownPlatform ? agencyGuess : "未辨識平台 (通用網址)",
        sourceUrl: cleanInput,
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
            saleTime: "2026-12-31 12:00",
            status: "active",
          },
        ],
        fanEvents: [],
        curatedShops: [],
      };

      setPreviousEvents([...events]);
      setPreviousSplits({ ...ticketSplits });
      setPreviousOffsets({ ...eventOffsets });

      const finalEvents = [newUrlEvent, ...events];
      setEvents(finalEvents);
      localStorage.setItem(
        "nonstop_challenger_events",
        JSON.stringify(finalEvents)
      );

      setAiNotice(
        isKnownPlatform
          ? `🎉 [網址自動辨識成功]：\n系統已自動為此連結【${agencyGuess}】建構專屬專案卡片！`
          : `ℹ️ [通用網址已匯入]：\n已為您建置連結專案，請手動更新售票平台與時區！`
      );
      setAiInput("");
      return;
    }

    // --- 2. 復原指令 ---
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

    // --- 3. 動態「新建:」手動建卡系統 ---
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

        setPreviousEvents([...events]);
        setPreviousSplits({ ...ticketSplits });
        setPreviousOffsets({ ...eventOffsets });

        const finalEvents = [newEvent, ...events];
        setEvents(finalEvents);
        localStorage.setItem(
          "nonstop_challenger_events",
          JSON.stringify(finalEvents)
        );

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

    // --- 4. 智慧語意狀態更新系統 ---
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

      setEvents(updatedEvents);
      localStorage.setItem(
        "nonstop_challenger_events",
        JSON.stringify(updatedEvents)
      );
      setAiNotice(`⚡ AI 語意分析連動成功：\n${noticeMessages.join("\n")}`);
      setAiInput("");
    } else {
      // 輔助友好提示：若打非關鍵字，則進行親切引導
      setAiNotice(
        `💡 系統已收到您的感測指令：\n"${cleanInput}"\n※ 貼上售票網址、或使用「新建:」公式，按下 Enter 即可自動建構！`
      );
      setAiInput("");
    }
  };

  // 鍵盤監聽：Enter 鍵提交（Shift+Enter 允許常規換行）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // 阻止 textarea 的預設換行行為
      handleProcessAiInput(aiInput);
    }
  };

  // 手動更新單一卡片狀態
  const handleStatusChange = (id: string, newStatus: any) => {
    const oldEvent = events.find((e) => e.id === id);
    if (
      oldEvent &&
      (oldEvent.statusLifecycle === "applied_drawing" ||
        oldEvent.statusLifecycle === "waiting_list") &&
      newStatus === "ended_no_ticket"
    ) {
      const cost = oldEvent.expenses.reduce((sum, exp) => sum + exp.cost, 0);
      setReleasedAmount(cost);
      setTimeout(() => setReleasedAmount(null), 5000);
    }

    const updated = events.map((event) =>
      event.id === id ? { ...event, statusLifecycle: newStatus } : event
    );
    saveEventsToStorage(updated);
  };

  // 手動更新備忘錄
  const handleNotesChange = (id: string, notes: string) => {
    const updated = events.map((event) =>
      event.id === id ? { ...event, userNotes: notes } : event
    );
    saveEventsToStorage(updated, false);
  };

  // 分票計數器
  const adjustSplitCount = (
    id: string,
    action: "increment" | "decrement" | "total_inc" | "total_dec"
  ) => {
    const current = ticketSplits[id] || { total: 1, split: 0 };
    let { total, split } = current;

    if (action === "increment" && split < total) split += 1;
    if (action === "decrement" && split > 0) split -= 1;
    if (action === "total_inc") total += 1;
    if (action === "total_dec" && total > 1) {
      total -= 1;
      if (split > total) split = total;
    }

    const updated = { ...ticketSplits, [id]: { total, split } };
    saveSplitsToStorage(updated);
  };

  const availableOffsets = Array.from({ length: 27 }, (_, i) => i - 12);

  // 一鍵重設
  const handleResetData = () => {
    if (confirm("確定要重設回預設測試資料嗎？")) {
      setPreviousEvents([...events]);
      setPreviousSplits({ ...ticketSplits });
      setPreviousRoles({ ...eventRoles });
      setPreviousOffsets({ ...eventOffsets });

      localStorage.clear();
      setEvents(initialMockEvents);
      setTicketSplits({ "event-yuuri-004": { total: 4, split: 2 } });
      setEventOffsets({ "event-yuuri-004": 9, "event-fujii-kaze-002": 8 });
      setEventRoles({});
      setAiNotice("🔄 已重設資料庫！(按 Ctrl+Z 可還原)");
    }
  };

  // 【100% 絕緣防萃取機制】
  const getGoogleCalendarLink = (
    title: string,
    dateStr: string,
    details: string
  ) => {
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
  };

  // 狀態樣式
  const statusBadges = {
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

  const categoryLabels: Record<string, string> = {
    all: "全部活動",
    official: "官方售票",
    fan_event: "粉絲線下",
    exhibition: "特展/文藝",
    ip_collab: "遊戲/IP聯動",
    doujin: "同人二創",
    seminar: "專業研討會",
  };

  const confirmedExpenses = events
    .filter(
      (e) =>
        e.statusLifecycle === "purchased" ||
        e.statusLifecycle === "ticket_splitting"
    )
    .reduce(
      (sum, e) => sum + e.expenses.reduce((s, exp) => s + exp.cost, 0),
      0
    );

  const drawingExpenses = events
    .filter(
      (e) =>
        e.statusLifecycle === "applied_drawing" ||
        e.statusLifecycle === "waiting_list"
    )
    .reduce(
      (sum, e) => sum + e.expenses.reduce((s, exp) => s + exp.cost, 0),
      0
    );

  const filteredEvents = events.filter((event) => {
    const matchesCategory =
      categoryFilter === "all" || event.type === categoryFilter;
    const matchesStatus =
      statusFilter === "all" || event.statusLifecycle === statusFilter;
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 pb-16 selection:bg-purple-500 selection:text-white">
      {/* 預算安全釋放浮動通知特效 */}
      {releasedAmount !== null && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-950 border-2 border-emerald-500 text-emerald-400 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-bounce font-mono font-bold">
          <CheckCircle2 className="text-emerald-400 animate-pulse" size={18} />
          💰 凍結資金解鎖釋放：+${releasedAmount.toLocaleString()} TWD！
        </div>
      )}

      {/* Header */}
      <header className="max-w-6xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-wider bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Nonstop Challenger 跨界流程調度中心
          </h1>
          {/* [微調 3]：增加瀏覽器偵測時區明確提示 */}
          <p className="text-xs text-slate-400 mt-1">
            底層邏輯大一統：網址智慧偵測建卡 · 地圖無縫串聯 · 全域自由時區
            (已偵測您的系統為 {formatGmtLabel(browserOffset)}) · 預算安全鎖
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {/* 備份控制 */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={exportData}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors"
              title="匯出資料備份檔 (.json)"
            >
              <Download size={12} /> 匯出
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors border-l border-slate-800"
              title="匯入資料備份檔"
            >
              <Upload size={12} /> 匯入
            </button>
          </div>

          <button
            onClick={handleResetData}
            className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors border border-slate-800 hover:border-rose-900/40 px-2 py-1.5 rounded-lg bg-slate-900/30"
          >
            🔄 重設
          </button>

          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex">
            <button
              onClick={() => setViewMode("show")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "show"
                  ? "bg-purple-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Calendar size={14} /> 演出行程
            </button>
            <button
              onClick={() => setViewMode("ticket")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "ticket"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <List size={14} /> 搶票管制點
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-6">
        {/* 全域財務預算 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <div>
              <p className="text-[10px] text-emerald-500 font-mono tracking-wider">
                CONFIRMED BUDGET
              </p>
              <h3 className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                ${confirmedExpenses.toLocaleString()}{" "}
                <span className="text-xs text-slate-500">TWD</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                已確認購入之項目規費支出
              </p>
            </div>
            <div className="bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-900/40 text-emerald-400">
              <DollarSign size={20} />
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
            <div>
              <p className="text-[10px] text-amber-500 font-mono tracking-wider">
                🔒 LOCKED ESCROW FUNDS
              </p>
              <h3 className="text-2xl font-bold font-mono text-amber-400 mt-1">
                ${drawingExpenses.toLocaleString()}{" "}
                <span className="text-xs text-slate-500">TWD</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                登記/候補中暫時凍結的預備規費
              </p>
            </div>
            <div className="bg-amber-950/30 p-2.5 rounded-lg border border-amber-900/40 text-amber-400">
              <TrendingUp size={20} />
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
            <div>
              <p className="text-[10px] text-purple-400 font-mono tracking-wider">
                MAX FLOW VOLUME
              </p>
              <h3 className="text-2xl font-bold font-mono text-purple-400 mt-1">
                ${(confirmedExpenses + drawingExpenses).toLocaleString()}{" "}
                <span className="text-xs text-slate-500">TWD</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                本季度最大可能流動規費與票面預算
              </p>
            </div>
            <div className="bg-purple-950/30 p-2.5 rounded-lg border border-purple-900/40 text-purple-400">
              <Layers size={20} />
            </div>
          </div>
        </section>

        {/* 語意感測入口 */}
        <section className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 text-purple-400 font-medium text-sm">
            <span className="flex items-center gap-2">
              <Sparkles size={16} /> 語意動態感測與卡片建構入口
            </span>
            <span className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-emerald-400 font-medium">
              💡 直接在下方貼上網址並按 Enter！
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={handleKeyDown} // 監聽 Enter 鍵
              placeholder="在此貼上售票網址 (tixCraft/KKTIX) 或輸入指令，完成後直接按 Enter，或點右側「智慧感測」按鈕！"
              className="flex-grow bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-colors h-16 resize-none"
            />
            <button
              onClick={() => handleProcessAiInput(aiInput)} // 點擊感測按鈕提交
              className="bg-purple-600 hover:bg-purple-500 border border-purple-500 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all shadow-md active:scale-95 flex items-center justify-center flex-shrink-0"
            >
              ⚡ 智慧感測
            </button>
          </div>

          {aiNotice && (
            <div className="mt-2 text-xs bg-slate-950 border border-slate-800 p-2.5 rounded-lg flex justify-between items-center animate-fadeIn">
              <span className="text-emerald-400 font-medium whitespace-pre-line leading-relaxed">
                {aiNotice}
              </span>
              {previousEvents && (
                <button
                  onClick={triggerUndo}
                  className="flex items-center gap-1.5 bg-purple-900/40 hover:bg-purple-800 border border-purple-700 hover:border-purple-600 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-purple-200 transition-all shadow-md active:scale-95 flex-shrink-0"
                >
                  <RotateCcw size={12} /> ↩️ 撤銷 (Ctrl+Z)
                </button>
              )}
            </div>
          )}
        </section>

        {/* 搜尋與過濾 */}
        <section className="space-y-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-3 text-slate-500"
              size={18}
            />
            <input
              type="text"
              placeholder="搜尋專案名稱、負責人、藝人、IP、演出地點..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
            {Object.keys(categoryLabels).map((key) => (
              <button
                key={key}
                onClick={() => setCategoryFilter(key)}
                className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border ${
                  categoryFilter === key
                    ? "bg-indigo-950 text-indigo-300 border-indigo-500"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                {categoryLabels[key]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 overflow-x-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                statusFilter === "all"
                  ? "bg-slate-200 text-slate-900"
                  : "bg-slate-900 text-slate-500 border border-slate-800"
              }`}
            >
              所有狀態
            </button>
            {Object.keys(statusBadges).map((key) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`text-xs px-2.5 py-1 rounded-md transition-all border ${
                  statusFilter === key
                    ? "bg-slate-800 text-slate-100 border-slate-600"
                    : "bg-slate-900 text-slate-500 border-slate-800"
                }`}
              >
                {statusBadges[key as keyof typeof statusBadges].label}
              </button>
            ))}
          </div>
        </section>

        {/* 活動卡片清單 */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event) => {
            const isExpanded = expandedCard === event.id;
            const badge =
              statusBadges[event.statusLifecycle] || statusBadges.watchlist;
            const totalCost = event.expenses.reduce(
              (sum, exp) => sum + exp.cost,
              0
            );
            const isSeminar = event.type === "seminar";

            const splitInfo = ticketSplits[event.id] || { total: 1, split: 0 };
            const isSplitFinished = splitInfo.split === splitInfo.total;

            const conflicts = getConflictingEvents(event);
            const hasConflict = conflicts.length > 0;
            const currentRole = eventRoles[event.id] || null;

            const venueOffset =
              eventOffsets[event.id] !== undefined
                ? eventOffsets[event.id]
                : browserOffset;

            return (
              <div
                key={event.id}
                className={`bg-slate-900 rounded-xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-md hover:shadow-xl ${
                  isExpanded
                    ? "ring-1 ring-purple-500/50 border-purple-500/50 scale-[1.01]"
                    : "border-slate-800"
                }`}
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedCard(isExpanded ? null : event.id)}
                >
                  {/* 卡片頭部 */}
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono tracking-wider">
                        {categoryLabels[event.type].toUpperCase()}
                      </span>
                      {currentRole === "primary" && (
                        <span className="flex items-center gap-0.5 text-[10px] bg-amber-950 text-amber-400 border border-amber-900 px-1.5 py-0.5 rounded">
                          <Star size={10} className="fill-amber-400" /> 主案
                        </span>
                      )}
                      {currentRole === "backup" && (
                        <span className="flex items-center gap-0.5 text-[10px] bg-slate-950 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded">
                          <Shield size={10} /> 備案
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] border px-2 py-0.5 rounded-md font-medium transition-colors ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <h3 className="font-semibold text-base text-slate-100 line-clamp-2 mb-1 hover:text-purple-300 transition-colors">
                    {event.title}
                  </h3>
                  <p className="text-xs text-indigo-400 font-medium mb-3">
                    {event.artist}
                  </p>

                  <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/50 space-y-1.5 text-xs">
                    {/* 雙軌並排展示 */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-purple-300 font-medium">
                        <span className="flex items-center gap-1">
                          🏟️ 舉辦地時間
                        </span>
                        <span className="font-mono text-slate-300">
                          {event.showDate.split(" ")[0]}{" "}
                          <span className="text-[9px] text-purple-400">
                            ({formatGmtLabel(venueOffset)})
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-400 font-medium text-[10px]">
                        <span className="flex items-center gap-1 pl-4">
                          🏠 您的本地時間
                        </span>
                        <span className="font-mono">
                          {convertToUserLocalTime(event.showDate, venueOffset)}{" "}
                          <span className="text-[8px] text-emerald-500">
                            ({formatGmtLabel(browserOffset)})
                          </span>
                        </span>
                      </div>
                    </div>

                    <div
                      className={`flex justify-between items-center pt-1 border-t border-slate-950/80 ${
                        viewMode === "ticket"
                          ? "text-indigo-300 font-medium"
                          : "text-slate-500"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        ⏱️ 下一階段搶票時程
                      </span>
                      <span className="font-mono text-[11px]">
                        {event.ticketStages
                          .find((s) => s.status !== "ended")
                          ?.saleTime.split(" ")[0] || "已截止"}
                      </span>
                    </div>
                  </div>

                  {/* 時間撞期黃色高亮警告 */}
                  {hasConflict && (
                    <div className="mt-3 flex items-center gap-1.5 bg-rose-950/30 border border-rose-900/40 text-rose-400 px-2.5 py-1.5 rounded-lg text-[10px]">
                      <AlertTriangle
                        size={12}
                        className="flex-shrink-0 animate-pulse text-rose-400"
                      />
                      <span>
                        精準警告：此時段與其他 {conflicts.length}{" "}
                        個方案【完全撞期】！
                      </span>
                    </div>
                  )}

                  {/* 一鍵導航 */}
                  <div className="flex items-center justify-between mt-3 text-xs">
                    <div className="flex items-center gap-1 text-slate-400 max-w-[70%]">
                      <MapPin
                        size={12}
                        className="text-rose-400 flex-shrink-0"
                      />
                      <span className="truncate">{event.location}</span>
                    </div>
                    <a
                      href={getNavigationUrl(event.location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800/80 px-2 py-1 rounded transition-all font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Navigation size={10} /> 導航
                    </a>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/40 p-4 space-y-4 text-xs animate-fadeIn">
                    {/* 地圖動態嵌入 */}
                    <div className="space-y-2">
                      <h4 className="text-slate-400 font-medium flex items-center gap-1">
                        <Map size={12} className="text-purple-400" /> 🗺️
                        現地會場街景與周邊地圖
                      </h4>
                      <div className="w-full h-40 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 relative">
                        <iframe
                          title="Venue Map"
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          scrolling="no"
                          marginHeight={0}
                          marginWidth={0}
                          src={getEmbedMapIframeUrl(event.location)}
                          className="opacity-80 hover:opacity-100 transition-opacity"
                          style={{ filter: "invert(90%) hue-rotate(180deg)" }}
                        />
                      </div>
                    </div>

                    {/* 舉辦地時區選單 */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[11px] text-slate-200 flex items-center gap-1">
                          <Globe size={12} className="text-purple-400" /> 🌍
                          舉辦地時區配置
                        </span>
                        <select
                          value={venueOffset}
                          onChange={(e) => {
                            const newOffset = parseInt(e.target.value);
                            const updatedOffsets = {
                              ...eventOffsets,
                              [event.id]: newOffset,
                            };
                            saveOffsetsToStorage(updatedOffsets);
                          }}
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 font-mono focus:outline-none"
                        >
                          {availableOffsets.map((offset) => (
                            <option key={offset} value={offset}>
                              {formatGmtLabel(offset)}{" "}
                              {offset === 8
                                ? " (台北/北京/港)"
                                : offset === 9
                                ? " (東京/首爾)"
                                : offset === 0
                                ? " (倫敦/UTC)"
                                : offset === -5
                                ? " (紐約/EST)"
                                : offset === -8
                                ? " (洛杉磯/PST)"
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 同日行程防撞配置 */}
                    {hasConflict && (
                      <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3">
                        <p className="font-semibold text-[11px] text-rose-400 flex items-center gap-1">
                          <AlertTriangle size={12} /> 同日行程調控與防撞配置
                        </p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              const newRoles = {
                                ...eventRoles,
                                [event.id]: "primary" as const,
                              };
                              conflicts.forEach((c) => {
                                newRoles[c.id] = "backup" as const;
                              });
                              saveRolesToStorage(newRoles);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-[10px] font-semibold border bg-amber-950/40 border-amber-500 text-amber-400"
                          >
                            <Star size={10} className="fill-amber-400" />{" "}
                            設為此時段主案
                          </button>
                          <button
                            onClick={() => {
                              const newRoles = {
                                ...eventRoles,
                                [event.id]: "backup" as const,
                              };
                              saveRolesToStorage(newRoles);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-[10px] font-semibold border bg-slate-900 border-slate-800 text-slate-400"
                          >
                            <Shield size={10} /> 設為備案
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Google 日曆匯入 */}
                    <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-semibold text-[11px] text-slate-200">
                            ⏱️ 日期追蹤管制
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            匯入日曆時，系統會自動在描述檔內為您標註時區換算。
                          </p>
                        </div>
                        <a
                          href={getGoogleCalendarLink(
                            event.title,
                            event.showDate,
                            `[時區資訊] 舉辦地時區: ${formatGmtLabel(
                              venueOffset
                            )}\n\n原始網址情報源: ${event.sourceUrl}`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/80 hover:border-indigo-600 px-2 py-1.5 rounded text-[10px] font-medium text-indigo-200 transition-colors whitespace-nowrap flex-shrink-0"
                        >
                          ➕ 匯入 Google 日曆
                        </a>
                      </div>
                    </div>

                    {/* 變更狀態 */}
                    <div className="flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                      <span className="font-medium text-slate-400">
                        變更活動狀態流程：
                      </span>
                      <select
                        value={event.statusLifecycle}
                        onChange={(e) =>
                          handleStatusChange(event.id, e.target.value as any)
                        }
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
                      >
                        {Object.keys(statusBadges).map((statusKey) => (
                          <option key={statusKey} value={statusKey}>
                            {
                              statusBadges[
                                statusKey as keyof typeof statusBadges
                              ].label
                            }
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <h4 className="text-slate-400 font-medium flex items-center gap-1 mb-1">
                        <FileText size={12} /> 個人隨手彈性備註
                      </h4>
                      <textarea
                        value={event.userNotes}
                        onChange={(e) =>
                          handleNotesChange(event.id, e.target.value)
                        }
                        placeholder="輸入私人備忘，系統會自動儲存..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-colors h-14 resize-none"
                      />
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-800 bg-slate-900/80 px-4 py-2.5 flex justify-between items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium truncate">
                    💼 {event.agency}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={event.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] px-2.5 py-1.5 rounded-lg transition-all border border-slate-700 font-medium"
                    >
                      官方情報網址 <ExternalLink size={10} />
                    </a>
                    <button
                      onClick={() =>
                        setExpandedCard(isExpanded ? null : event.id)
                      }
                      className="text-slate-400 hover:text-slate-200 p-1 bg-slate-950/40 border border-slate-800 rounded-lg"
                    >
                      {isExpanded ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto mt-12 pt-4 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-full text-[10px] text-emerald-400 font-mono tracking-wider shadow-inner">
          <Wifi size={12} className="animate-pulse text-emerald-400" />
          <span>NONSTOP CHALLENGER OFFLINE-READY PWA ACTIVE (LOCALFIRST)</span>
        </div>
      </footer>
    </div>
  );
}
