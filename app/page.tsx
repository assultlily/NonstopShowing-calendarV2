"use client";

import React, { useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { mockEvents as initialMockEvents, ShowEvent } from "./mockEvents";
import { supabase } from "./lib/supabaseClient";
import { fetchEvents, syncEvents } from "./lib/eventsApi";
import { sendLoginLink, signOut } from "./lib/authApi";
import { TRANSLATIONS, LangType } from "./lib/translations";
import { ChecklistItem, AlarmConfig } from "./types";
import {
  getUtcTimestamp,
  formatGmtLabel,
  identifyTicketPlatform,
  STATUS_BADGES,
} from "./lib/helpers";
import EventCard from "./components/EventCard";
import {
  Calendar,
  List,
  Search,
  Layers,
  DollarSign,
  FileText,
  Sparkles,
  TrendingUp,
  Download,
  Upload,
  RotateCcw,
  Globe,
  Wifi,
  CheckCircle2,
  CheckSquare,
  Square,
  Plus,
  Trash2,
} from "lucide-react";

export default function Dashboard() {
  // 帳號登入狀態
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authStatus, setAuthStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [authErrorMsg, setAuthErrorMsg] = useState("");

  const [viewMode, setViewMode] = useState<"show" | "ticket">("show");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // 1. 語系狀態
  const [lang, setLang] = useState<LangType>("zh");
  const t = TRANSLATIONS[lang];

  // 2. 核心貨幣狀態 & 自訂匯率小工具
  const [currency, setCurrency] = useState<"TWD" | "USD" | "JPY" | "EUR">(
    "TWD"
  );
  const [rates, setRates] = useState({
    TWD: 1,
    USD: 0.031,
    JPY: 4.85,
    EUR: 0.029,
  });

  const handleRateChange = (cur: "USD" | "JPY" | "EUR", val: number) => {
    setRates((prev) => ({
      ...prev,
      [cur]: val,
    }));
  };

  // 統一貨幣換算輔助函式
  const formatAmount = (amountInTWD: number) => {
    const symbolMap = {
      TWD: "NT$",
      USD: "$",
      JPY: "¥",
      EUR: "€",
    };
    const rate = rates[currency];
    const converted = amountInTWD * rate;
    return `${symbolMap[currency]} ${Math.round(converted).toLocaleString()}`;
  };

  // 3. 旅遊提醒清單 Checklist 狀態
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");

  // 4. 行程鬧鐘狀態
  const [alarms, setAlarms] = useState<Record<string, AlarmConfig>>({});

  // 核心資料狀態
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

  // 全球時區
  const [eventOffsets, setEventOffsets] = useState<Record<string, number>>({});
  const [browserOffset, setBrowserOffset] = useState<number>(8);

  // 資金釋放特效狀態
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

  // 登入狀態監聽：頁面載入時檢查是否已有 session，並持續監聽登入/登出事件
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  // 登入後從 Supabase 讀取這位使用者的活動卡片（取代原本的 localStorage 讀取）
  useEffect(() => {
    if (!user) return;
    fetchEvents()
      .then((data) => {
        setEvents(data.length > 0 ? data : initialMockEvents);
      })
      .catch((err) => {
        console.error("讀取雲端資料失敗：", err);
        setAiNotice("⚠️ 讀取雲端資料失敗，請檢查網路連線後重新整理頁面。");
        setEvents(initialMockEvents);
      });
  }, [user]);

  // 初始化載入資料與時區偵測（events 已改由上方 Supabase 讀取，這裡只處理仍留在本機的其他設定）
  useEffect(() => {
    const localOffset = -new Date().getTimezoneOffset() / 60;
    setBrowserOffset(localOffset);

    const savedSplits = localStorage.getItem("nonstop_challenger_splits");
    const savedRoles = localStorage.getItem("nonstop_challenger_roles");
    const savedOffsets = localStorage.getItem("nonstop_challenger_offsets");
    const savedChecklist = localStorage.getItem("nonstop_challenger_checklist");
    const savedAlarms = localStorage.getItem("nonstop_challenger_alarms");
    const savedRates = localStorage.getItem("nonstop_challenger_rates");

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

    if (savedChecklist) {
      try {
        setChecklist(JSON.parse(savedChecklist));
      } catch (e) {
        setChecklist([]);
      }
    } else {
      setChecklist([
        {
          id: "1",
          text: "確認護照效期大於 6 個月",
          completed: false,
          notes: "抽屜第二格",
        },
        {
          id: "2",
          text: "開通海外信用卡刷卡與海外提款",
          completed: false,
          notes: "主刷中信/備用富邦",
        },
      ]);
    }

    if (savedAlarms) {
      try {
        setAlarms(JSON.parse(savedAlarms));
      } catch (e) {
        setAlarms({});
      }
    }

    if (savedRates) {
      try {
        setRates(JSON.parse(savedRates));
      } catch (e) {}
    }
  }, []);

  // 鬧鐘定時檢測機制 (每 10 秒掃描一次)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      events.forEach((event) => {
        const config = alarms[event.id];
        if (config && config.enabled) {
          const venueOffset =
            eventOffsets[event.id] !== undefined
              ? eventOffsets[event.id]
              : browserOffset;
          const eventTime = getUtcTimestamp(event.showDate, venueOffset);
          const alarmTime = eventTime - config.minutesAhead * 60 * 1000;

          // 若在當前時間前後 30 秒內，且尚未觸發過，則彈出提示
          if (Math.abs(now - alarmTime) < 30000) {
            if (Notification.permission === "granted") {
              new Notification(`${t.alarmTriggered}${event.title}`, {
                body: `${event.artist} @ ${event.location}\n開始時間：${event.showDate}`,
              });
            } else {
              alert(
                `${t.alarmTriggered}\n【${event.title}】\n即將在 ${config.minutesAhead} 分鐘後開始！`
              );
            }
            // 觸發後關閉避免重複彈出
            toggleAlarm(event.id, false);
          }
        }
      });
    }, 10000);

    return () => clearInterval(timer);
  }, [events, alarms, eventOffsets, browserOffset, lang]);

  // 要求桌面通知權限
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // 儲存輔助：events 現在同步到 Supabase，其餘設定仍暫留在 localStorage
  const saveEventsToStorage = (newEvents: ShowEvent[], takeSnapshot = true) => {
    if (takeSnapshot) {
      setPreviousEvents([...events]);
      setPreviousRoles({ ...eventRoles });
      setPreviousOffsets({ ...eventOffsets });
    }
    const oldEvents = events;
    setEvents(newEvents);
    syncEvents(newEvents, oldEvents).catch((err) => {
      console.error("同步雲端資料失敗：", err);
      setAiNotice("⚠️ 資料同步到雲端失敗，請檢查網路連線後重試一次。");
    });
  };

  const saveChecklistToStorage = (newList: ChecklistItem[]) => {
    setChecklist(newList);
    localStorage.setItem(
      "nonstop_challenger_checklist",
      JSON.stringify(newList)
    );
  };

  const saveAlarmsToStorage = (newAlarms: Record<string, AlarmConfig>) => {
    setAlarms(newAlarms);
    localStorage.setItem(
      "nonstop_challenger_alarms",
      JSON.stringify(newAlarms)
    );
  };

  // 旅遊 Checklist 操作
  const addChecklistItem = () => {
    if (!newCheckItem.trim()) return;
    const newItem: ChecklistItem = {
      id: `check-${Date.now()}`,
      text: newCheckItem.trim(),
      completed: false,
      notes: "",
    };
    const updated = [...checklist, newItem];
    saveChecklistToStorage(updated);
    setNewCheckItem("");
  };

  const toggleChecklistCompleted = (id: string) => {
    const updated = checklist.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    saveChecklistToStorage(updated);
  };

  const updateChecklistNotes = (id: string, notes: string) => {
    const updated = checklist.map((item) =>
      item.id === id ? { ...item, notes } : item
    );
    saveChecklistToStorage(updated);
  };

  const deleteChecklistItem = (id: string) => {
    const updated = checklist.filter((item) => item.id !== id);
    saveChecklistToStorage(updated);
  };

  // 鬧鐘操作
  const toggleAlarm = (eventId: string, forceEnabled?: boolean) => {
    const current = alarms[eventId] || { enabled: false, minutesAhead: 30 };
    const nextEnabled =
      forceEnabled !== undefined ? forceEnabled : !current.enabled;
    const updated = {
      ...alarms,
      [eventId]: { ...current, enabled: nextEnabled },
    };
    saveAlarmsToStorage(updated);
  };

  const updateAlarmTime = (eventId: string, minutes: number) => {
    const current = alarms[eventId] || { enabled: false, minutesAhead: 30 };
    const updated = {
      ...alarms,
      [eventId]: { ...current, minutesAhead: minutes },
    };
    saveAlarmsToStorage(updated);
  };

  // 鍵盤快速鍵 Ctrl+Z 監聽
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

  const saveSplitsToStorage = (
    newSplits: Record<string, { total: number; split: number }>,
    takeSnapshot = true
  ) => {
    if (takeSnapshot) setPreviousSplits({ ...ticketSplits });
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

  const triggerUndo = () => {
    if (!previousEvents) return;
    const currentEvents = [...events];
    const currentSplits = { ...ticketSplits };
    const currentRoles = { ...eventRoles };
    const currentOffsets = { ...eventOffsets };

    setEvents(previousEvents);
    syncEvents(previousEvents, currentEvents).catch((err) => {
      console.error("復原同步雲端失敗：", err);
      setAiNotice("⚠️ 復原已套用在畫面上，但同步到雲端失敗，請檢查網路連線。");
    });

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

  // 全球時區換算
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

  // 取得 UTC 毫秒戳記
  // 【精準防撞時間衝突偵測：重疊 3 小時內】
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

      const diffMs = Math.abs(currentUtc - eUtc);
      const hoursDiff = diffMs / (1000 * 60 * 60);

      // 防撞界限設為 3 小時
      return hoursDiff < 3;
    });
  };

  const exportData = () => {
    const backupData = {
      events,
      ticketSplits,
      eventRoles,
      eventOffsets,
      checklist,
      alarms,
      rates,
      version: "6.0-UltimateIntegration",
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

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. 檔案大小限制 (例如 1MB，防止超大 JSON 灌入記憶體)
    if (file.size > 1024 * 1024) {
      alert("❌ 錯誤：檔案過大，請確認是否為正確的備份檔。");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);

        // 2. 結構預檢：確保必要欄位存在，且不是惡意注入的空物件
        if (imported && typeof imported === "object" && "events" in imported) {
          // ... (保持你原本的後續處理邏輯)
          saveEventsToStorage(imported.events);
          // ...
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

  const handleProcessAiInput = (rawInput: string) => {
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
    let updatedEvents = [...events];
    const noticeMessages: string[] = [];

    // 網址智慧辨識建卡系統
    // 允許使用者貼上沒有 http(s):// 開頭的網址（例如從分享功能複製出來的網址常常會被拿掉協議）
    const looksLikeUrl =
      text.startsWith("http://") ||
      text.startsWith("https://") ||
      /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(cleanInput.split(/\s+/)[0]);

    if (looksLikeUrl) {
      // 若使用者沒帶協議，統一補上 https:// 以確保後續連結可正常開啟、平台比對邏輯一致
      const normalizedUrl = /^https?:\/\//i.test(cleanInput)
        ? cleanInput
        : `https://${cleanInput}`;

      const match = identifyTicketPlatform(normalizedUrl);
      const agencyGuess = match ? match.platform : "外部網站連結專案";
      const isKnownPlatform = !!match;

      const urlParts = cleanInput.split("/");
      let guessedTitle =
        urlParts[urlParts.length - 1] ||
        urlParts[urlParts.length - 2] ||
        "未命名網址匯入活動";
      if (guessedTitle.length > 25)
        guessedTitle = guessedTitle.substring(0, 22) + "...";
      guessedTitle = `🌐 網址：${guessedTitle.toUpperCase()}`;

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
          text.includes("confetti")
            ? "日本現地會場"
            : "未指定地點 (請展開本卡片手動微調)",
        showDate: "2026-12-31 19:00",
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

      const oldEventsSnapshot = events;
      const finalEvents = [newUrlEvent, ...events];
      setEvents(finalEvents);
      syncEvents(finalEvents, oldEventsSnapshot).catch((err) => {
        console.error("同步雲端失敗：", err);
        setAiNotice("⚠️ 卡片已建立在畫面上，但同步到雲端失敗，請檢查網路連線。");
      });

      setAiNotice(
        isKnownPlatform
          ? `🎉 [網址自動辨識成功]：\n系統已自動為此連結【${agencyGuess}】建構專屬專案卡片！`
          : `ℹ️ [通用網址已匯入]：\n已為您建置連結專案，請手動更新售票平台與時區！`
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

  const handleStatusChange = (
    id: string,
    newStatus: ShowEvent["statusLifecycle"]
  ) => {
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

  const handleNotesChange = (id: string, notes: string) => {
    const updated = events.map((event) =>
      event.id === id ? { ...event, userNotes: notes } : event
    );
    saveEventsToStorage(updated, false);
  };

  const availableOffsets = Array.from({ length: 27 }, (_, i) => i - 12);

  const handleResetData = () => {
    if (confirm("確定要重設回預設測試資料嗎？")) {
      setPreviousEvents([...events]);
      setPreviousSplits({ ...ticketSplits });
      setPreviousRoles({ ...eventRoles });
      setPreviousOffsets({ ...eventOffsets });

      const oldEventsSnapshot = events;
      localStorage.clear();
      setEvents(initialMockEvents);
      syncEvents(initialMockEvents, oldEventsSnapshot).catch((err) => {
        console.error("重設雲端資料失敗：", err);
        setAiNotice("⚠️ 畫面已重設，但同步到雲端失敗，請檢查網路連線。");
      });
      setTicketSplits({ "event-yuuri-004": { total: 4, split: 2 } });
      setEventOffsets({ "event-yuuri-004": 9, "event-fujii-kaze-002": 8 });
      setEventRoles({});
      setChecklist([
        {
          id: "1",
          text: "確認護照效期大於 6 個月",
          completed: false,
          notes: "抽屜第二格",
        },
        {
          id: "2",
          text: "開通海外信用卡刷卡與海外提款",
          completed: false,
          notes: "主刷中信/備用富邦",
        },
      ]);
      setAlarms({});
      setRates({ TWD: 1, USD: 0.031, JPY: 4.85, EUR: 0.029 });
      setAiNotice("🔄 已重設資料庫！(按 Ctrl+Z 可還原)");
    }
  };

  const categoryLabels: Record<string, string> = {
    all: lang === "zh" ? "全部活動" : "All Events",
    official: lang === "zh" ? "官方售票" : "Official Ticketing",
    fan_event: lang === "zh" ? "粉絲線下" : "Fan Events",
    exhibition: lang === "zh" ? "特展/文藝" : "Exhibitions",
    ip_collab: lang === "zh" ? "遊戲/IP聯動" : "Game/IP Collab",
    doujin: lang === "zh" ? "同人二創" : "Doujin/Fandom",
    seminar: lang === "zh" ? "專業研討會" : "Seminars",
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

  const filteredEvents = events
    .filter((event) => {
      const matchesCategory =
        categoryFilter === "all" || event.type === categoryFilter;
      const matchesStatus =
        statusFilter === "all" || event.statusLifecycle === statusFilter;
      const matchesSearch =
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesStatus && matchesSearch;
    })
    // 依演出日期由近到遠排序，避免新增/匯入後卡片順序與實際時間線脫節
    .sort((a, b) => {
      const offsetA = eventOffsets[a.id] !== undefined ? eventOffsets[a.id] : browserOffset;
      const offsetB = eventOffsets[b.id] !== undefined ? eventOffsets[b.id] : browserOffset;
      return getUtcTimestamp(a.showDate, offsetA) - getUtcTimestamp(b.showDate, offsetB);
    });

  const handleSendLoginLink = async () => {
    if (!authEmail.trim()) return;
    setAuthStatus("sending");
    setAuthErrorMsg("");
    try {
      await sendLoginLink(authEmail.trim());
      setAuthStatus("sent");
    } catch (err) {
      setAuthStatus("error");
      setAuthErrorMsg(
        err instanceof Error ? err.message : "發送失敗，請稍後再試。"
      );
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("登出失敗：", err);
    }
  };

  // 正在確認是否已登入，先顯示簡單的載入畫面
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        正在確認登入狀態...
      </div>
    );
  }

  // 尚未登入：顯示 Email 登入表單（Magic Link，不需要密碼）
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
          <h1 className="text-lg font-semibold text-slate-100">
            登入 Nonstop Challenger
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            輸入 Email，我們會寄一組登入連結到你的信箱，點擊連結即可登入（不需要密碼）。登入後資料會存在雲端，換裝置也能看到。
          </p>
          <input
            type="email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendLoginLink()}
            placeholder="you@example.com"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <button
            onClick={handleSendLoginLink}
            disabled={authStatus === "sending"}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-all active:scale-95"
          >
            {authStatus === "sending" ? "傳送中..." : "傳送登入連結"}
          </button>
          {authStatus === "sent" && (
            <p className="text-xs text-emerald-400">
              📩 已寄出登入連結，請到信箱點擊連結完成登入（記得看一下垃圾郵件）。
            </p>
          )}
          {authStatus === "error" && (
            <p className="text-xs text-rose-400">❌ {authErrorMsg}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 pb-16 selection:bg-purple-500 selection:text-white">
      {/* 預算安全釋放浮動通知特效 */}
      {releasedAmount !== null && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-950 border-2 border-emerald-500 text-emerald-400 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-bounce font-mono font-bold">
          <CheckCircle2 className="text-emerald-400 animate-pulse" size={18} />
          💰 凍結資金解鎖釋放：+{formatAmount(releasedAmount)}！
        </div>
      )}

      {/* Header */}
      <header className="max-w-6xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-wider bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            {t.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t.subtitle} (已偵測您的系統為 {formatGmtLabel(browserOffset)})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {/* 帳號資訊 / 登出 */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg">
            <span className="truncate max-w-[140px]">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="text-slate-500 hover:text-rose-400 transition-colors underline decoration-dotted"
            >
              登出
            </button>
          </div>

          {/* 語系切換 */}
          <button
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300 hover:text-white transition-all flex items-center gap-1"
          >
            <Globe size={13} /> {t.langBtn}
          </button>

          {/* 貨幣選擇器 */}
          <select
            value={currency}
            onChange={(e) =>
              setCurrency(e.target.value as "TWD" | "USD" | "JPY" | "EUR")
            }
            className="bg-slate-900 text-white border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg text-xs focus:outline-none"
          >
            <option value="TWD">TWD (NT$)</option>
            <option value="USD">USD ($)</option>
            <option value="JPY">JPY (¥)</option>
            <option value="EUR">EUR (€)</option>
          </select>

          {/* 備份控制 */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={exportData}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors"
              title="匯出資料備份檔 (.json)"
            >
              <Download size={12} /> {t.export}
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
              <Upload size={12} /> {t.import}
            </button>
            <button
              onClick={handleResetData}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 hover:bg-slate-800 px-2 py-1 rounded transition-colors border-l border-slate-800"
              title="重設回預設測試資料"
            >
              <RotateCcw size={12} /> {t.reset}
            </button>
          </div>

          <button
            onClick={() => {
              // 獨立作用域，不影響組件其他狀態
              const targetEvents = events.filter(
                (e) =>
                  e.statusLifecycle === "purchased" ||
                  e.statusLifecycle === "applied_drawing"
              );
              const headers = ["專案", "藝人", "地點", "日期", "主辦", "狀態"];
              const rows = targetEvents.map((e) => [
                String(e.title || "").replace(/[=+\-@,]/g, ""),
                String(e.artist || "").replace(/[=+\-@,]/g, ""),
                String(e.location || "").replace(/[=+\-@,]/g, ""),
                e.showDate || "",
                e.agency || "",
                e.statusLifecycle || "",
              ]);

              // 產生 CSV 字串 (加入 BOM 確保 Excel 開啟不亂碼)
              const csvContent =
                "\uFEFF" +
                [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
              const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
              });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `參戰清單_${
                new Date().toISOString().split("T")[0]
              }.csv`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-white hover:bg-emerald-900/30 border border-emerald-900/50 px-2 py-1.5 rounded-lg transition-all"
            title="匯出已確認或登記中的參戰清單至 Excel"
          >
            <FileText size={12} />{" "}
            {lang === "zh" ? "匯出 Excel" : "Export Excel"}
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
              <Calendar size={14} /> {lang === "zh" ? "演出行程" : "Schedules"}
            </button>
            <button
              onClick={() => setViewMode("ticket")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "ticket"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <List size={14} />{" "}
              {lang === "zh" ? "搶票管制點" : "Key Timelines"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-6">
        {/* 貨幣匯率小工具 */}
        <section className="bg-slate-900 rounded-xl border border-slate-800 p-3 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <TrendingUp size={14} className="text-purple-400" />{" "}
            {t.currencyWidget}
          </span>
          <div className="flex flex-wrap gap-4 items-center">
            {["USD", "JPY", "EUR"].map((cur) => {
              const curKey = cur as "USD" | "JPY" | "EUR";
              return (
                <div
                  key={cur}
                  className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded px-2 py-1"
                >
                  <span className="text-slate-500 uppercase">{cur}:</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={rates[curKey]}
                    onChange={(e) =>
                      handleRateChange(curKey, parseFloat(e.target.value) || 0)
                    }
                    className="bg-transparent text-slate-300 w-16 focus:outline-none font-mono text-xs"
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* 全球財務預算卡片 (在選定幣值情形下，自動調整成同一幣值) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <div>
              <p className="text-[10px] text-emerald-500 font-mono tracking-wider">
                {t.budget}
              </p>
              <h3 className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {formatAmount(confirmedExpenses)}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                {lang === "zh"
                  ? "已確認購入之項目規費支出"
                  : "Confirmed expenses for purchased items"}
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
                🔒 {t.escrow}
              </p>
              <h3 className="text-2xl font-bold font-mono text-amber-400 mt-1">
                {formatAmount(drawingExpenses)}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                {lang === "zh"
                  ? "登記/候補中暫時凍結的預備規費"
                  : "Temporarily locked escrow funds"}
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
                {t.volume}
              </p>
              <h3 className="text-2xl font-bold font-mono text-purple-400 mt-1">
                {formatAmount(confirmedExpenses + drawingExpenses)}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                {lang === "zh"
                  ? "本季度最大可能流動規費與票面預算"
                  : "Maximum possible flow volume this quarter"}
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
              <Sparkles size={16} />{" "}
              {lang === "zh"
                ? "語意動態感測與卡片建構入口"
                : "Semantic Intelligence Entry"}
            </span>
            <span className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-emerald-400 font-medium">
              💡{" "}
              {lang === "zh"
                ? "直接在下方貼上網址並按 Enter！"
                : "Directly paste ticketing link and press Enter!"}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={handleKeyDownInput}
              placeholder={
                lang === "zh"
                  ? "在此貼上任何售票網址（如 拓元/KKTIX/OPENTIX/eplus/pia 等）或輸入指令，完成後按 Enter！"
                  : "Paste ticketing links (tixCraft/KKTIX/OPENTIX/eplus/pia) or command, then press Enter!"
              }
              className="flex-grow bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-colors h-16 resize-none"
            />
            <button
              onClick={() => handleProcessAiInput(aiInput)}
              className="bg-purple-600 hover:bg-purple-500 border border-purple-500 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all shadow-md active:scale-95 flex items-center justify-center flex-shrink-0"
            >
              ⚡ {lang === "zh" ? "智慧感測" : "Analyze"}
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
                  <RotateCcw size={12} /> ↩️{" "}
                  {lang === "zh" ? "撤銷 (Ctrl+Z)" : "Undo (Ctrl+Z)"}
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
              placeholder={t.searchPlaceholder}
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
              {lang === "zh" ? "所有狀態" : "All Statuses"}
            </button>
            {Object.keys(STATUS_BADGES).map((key) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`text-xs px-2.5 py-1 rounded-md transition-all border ${
                  statusFilter === key
                    ? "bg-slate-800 text-slate-100 border-slate-600"
                    : "bg-slate-900 text-slate-500 border-slate-800"
                }`}
              >
                {STATUS_BADGES[key].label}
              </button>
            ))}
          </div>
        </section>

        {/* 雙欄布局：左側活動卡片列表 / 右側旅遊隨身清單 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側：活動列表 (佔用 2 欄) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEvents.map((event) => {
                const conflicts = getConflictingEvents(event);
                const currentRole = eventRoles[event.id] || null;
                const venueOffset =
                  eventOffsets[event.id] !== undefined
                    ? eventOffsets[event.id]
                    : browserOffset;
                const alarmConfig = alarms[event.id] || {
                  enabled: false,
                  minutesAhead: 30,
                };
                const totalCost = event.expenses.reduce(
                  (sum, exp) => sum + exp.cost,
                  0
                );

                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    isExpanded={expandedCard === event.id}
                    onToggleExpand={() =>
                      setExpandedCard(
                        expandedCard === event.id ? null : event.id
                      )
                    }
                    lang={lang}
                    t={t}
                    categoryLabel={categoryLabels[event.type]}
                    currentRole={currentRole}
                    conflicts={conflicts}
                    venueOffset={venueOffset}
                    browserOffset={browserOffset}
                    availableOffsets={availableOffsets}
                    alarmConfig={alarmConfig}
                    totalCost={totalCost}
                    formatAmount={formatAmount}
                    convertToUserLocalTime={convertToUserLocalTime}
                    onToggleAlarm={toggleAlarm}
                    onUpdateAlarmTime={updateAlarmTime}
                    onOffsetChange={(eventId, newOffset) => {
                      const updatedOffsets = {
                        ...eventOffsets,
                        [eventId]: newOffset,
                      };
                      saveOffsetsToStorage(updatedOffsets);
                    }}
                    onSetPrimary={(eventId, conflictIds) => {
                      const newRoles = {
                        ...eventRoles,
                        [eventId]: "primary" as const,
                      };
                      conflictIds.forEach((cid) => {
                        newRoles[cid] = "backup" as const;
                      });
                      saveRolesToStorage(newRoles);
                    }}
                    onSetBackup={(eventId) => {
                      const newRoles = {
                        ...eventRoles,
                        [eventId]: "backup" as const,
                      };
                      saveRolesToStorage(newRoles);
                    }}
                    onStatusChange={handleStatusChange}
                    onNotesChange={handleNotesChange}
                  />
                );
              })}
            </div>
          </div>

          {/* 右側：精緻旅遊提醒清單 Checklist (佔用 1 欄) */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col h-fit">
            <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2.5 mb-3">
              <CheckSquare size={16} className="text-purple-400" />{" "}
              {t.checklistTitle}
            </h3>

            {/* 新增項目輸入框 */}
            <div className="flex gap-1.5 mb-4">
              <input
                type="text"
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                placeholder={t.checklistPlaceholder}
                className="flex-grow bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={addChecklistItem}
                className="bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all active:scale-95 flex items-center gap-0.5"
              >
                <Plus size={14} /> {t.addBtn}
              </button>
            </div>

            {/* 清單項目列表 */}
            {checklist.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-6">
                {t.noChecklist}
              </p>
            ) : (
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80 space-y-2 flex flex-col justify-between transition-all hover:border-slate-700"
                  >
                    <div className="flex items-start gap-2 justify-between">
                      <button
                        onClick={() => toggleChecklistCompleted(item.id)}
                        className="flex items-start gap-2 text-left flex-grow focus:outline-none"
                      >
                        {item.completed ? (
                          <CheckCircle2
                            size={15}
                            className="text-emerald-400 mt-0.5 flex-shrink-0"
                          />
                        ) : (
                          <Square
                            size={15}
                            className="text-slate-600 mt-0.5 flex-shrink-0"
                          />
                        )}
                        <span
                          className={`text-xs ${
                            item.completed
                              ? "line-through text-slate-600"
                              : "text-slate-200 font-medium"
                          }`}
                        >
                          {item.text}
                        </span>
                      </button>
                      <button
                        onClick={() => deleteChecklistItem(item.id)}
                        className="text-slate-600 hover:text-rose-400 p-0.5 transition-colors focus:outline-none"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* 自訂隨手欄位備註 */}
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) =>
                        updateChecklistNotes(item.id, e.target.value)
                      }
                      placeholder={t.memoPlaceholder}
                      className="w-full bg-slate-900 border border-slate-800/60 rounded px-2 py-1 text-[10px] text-slate-400 placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 font-sans"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
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
