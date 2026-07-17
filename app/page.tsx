"use client";

import React, { useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { mockEvents as initialMockEvents, ShowEvent } from "./mockEvents";
import { supabase } from "./lib/supabaseClient";
import { fetchEvents, syncEvents } from "./lib/eventsApi";
import { fetchUserSettings, syncUserSettings } from "./lib/settingsApi";
import { sendLoginLink, signOut } from "./lib/authApi";
import { TRANSLATIONS, LangType } from "./lib/translations";
import { ChecklistItem, AlarmConfig } from "./types";
import {
  getUtcTimestamp,
  formatGmtLabel,
  STATUS_BADGES,
  convertToTwd,
} from "./lib/helpers";
import EventCard from "./components/EventCard";
import AiInputBar from "./components/AiInputBar";
import TrashBin from "./components/TrashBin";
import CategoryChart from "./components/CategoryChart";
import { useAiInputProcessor } from "./hooks/useAiInputProcessor";
import {
  Calendar,
  List,
  Search,
  Layers,
  DollarSign,
  FileText,
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
  PieChart,
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
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);

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
    setRates((prev) => {
      const updated = { ...prev, [cur]: val };
      localStorage.setItem("nonstop_challenger_rates", JSON.stringify(updated));
      return updated;
    });
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

  // 復原系統：歷史紀錄堆疊（取代原本只能記一步的單一快照），最多保留 20 步
  const MAX_HISTORY = 20;
  interface HistorySnapshot {
    events: ShowEvent[];
    ticketSplits: Record<string, { total: number; split: number }>;
    eventRoles: Record<string, "primary" | "backup">;
    eventOffsets: Record<string, number>;
  }
  const [history, setHistory] = useState<HistorySnapshot[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 在任何會修改資料的操作「之前」呼叫，把當下狀態推進歷史堆疊
  const pushHistory = () => {
    setHistory((prev) =>
      [
        ...prev,
        {
          events: [...events],
          ticketSplits: { ...ticketSplits },
          eventRoles: { ...eventRoles },
          eventOffsets: { ...eventOffsets },
        },
      ].slice(-MAX_HISTORY)
    );
  };

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

  // 登入後從 Supabase 讀取這位使用者的其他設定（清單、鬧鐘、分票、時區、主案備案）
  useEffect(() => {
    if (!user) return;
    fetchUserSettings()
      .then((settings) => {
        setTicketSplits(
          Object.keys(settings.ticketSplits).length > 0
            ? settings.ticketSplits
            : { "event-yuuri-004": { total: 4, split: 2 } }
        );
        setEventRoles(settings.eventRoles);
        setEventOffsets(
          Object.keys(settings.eventOffsets).length > 0
            ? settings.eventOffsets
            : { "event-yuuri-004": 9, "event-fujii-kaze-002": 8 }
        );
        setChecklist(
          settings.checklist.length > 0
            ? settings.checklist
            : [
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
              ]
        );
        setAlarms(settings.alarms);
      })
      .catch((err) => {
        console.error("讀取雲端設定失敗：", err);
        setAiNotice("⚠️ 讀取雲端設定失敗，請檢查網路連線後重新整理頁面。");
      });
  }, [user]);

  // 初始化載入資料與時區偵測（events、splits、roles、offsets、checklist、alarms 已改由 Supabase 讀取，這裡只處理匯率偏好設定）
  useEffect(() => {
    const localOffset = -new Date().getTimezoneOffset() / 60;
    setBrowserOffset(localOffset);

    const savedRates = localStorage.getItem("nonstop_challenger_rates");
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
      pushHistory();
    }
    const oldEvents = events;
    setEvents(newEvents);
    syncEvents(newEvents, oldEvents).catch((err) => {
      console.error("同步雲端資料失敗：", err);
      setAiNotice("⚠️ 資料同步到雲端失敗，請檢查網路連線後重試一次。");
    });
  };

  // 把「清單/鬧鐘/分票/主案備案/時區」這幾項設定同步到雲端
  // overrides 放這次真正改動的欄位（因為 React state 還沒更新完成，不能直接讀當下的 state）
  const syncSettingsToCloud = (
    overrides: Partial<{
      checklist: ChecklistItem[];
      alarms: Record<string, AlarmConfig>;
      ticketSplits: Record<string, { total: number; split: number }>;
      eventRoles: Record<string, "primary" | "backup">;
      eventOffsets: Record<string, number>;
    }>
  ) => {
    syncUserSettings({
      checklist,
      alarms,
      ticketSplits,
      eventRoles,
      eventOffsets,
      ...overrides,
    }).catch((err) => {
      console.error("同步設定到雲端失敗：", err);
      setAiNotice("⚠️ 設定已更新在畫面上，但同步到雲端失敗，請檢查網路連線。");
    });
  };

  const saveChecklistToStorage = (newList: ChecklistItem[]) => {
    setChecklist(newList);
    localStorage.setItem(
      "nonstop_challenger_checklist",
      JSON.stringify(newList)
    );
    syncSettingsToCloud({ checklist: newList });
  };

  const saveAlarmsToStorage = (newAlarms: Record<string, AlarmConfig>) => {
    setAlarms(newAlarms);
    localStorage.setItem(
      "nonstop_challenger_alarms",
      JSON.stringify(newAlarms)
    );
    syncSettingsToCloud({ alarms: newAlarms });
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
        if (history.length > 0) {
          e.preventDefault();
          triggerUndo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history]);

  const saveSplitsToStorage = (
    newSplits: Record<string, { total: number; split: number }>,
    takeSnapshot = true
  ) => {
    if (takeSnapshot) pushHistory();
    setTicketSplits(newSplits);
    localStorage.setItem(
      "nonstop_challenger_splits",
      JSON.stringify(newSplits)
    );
    syncSettingsToCloud({ ticketSplits: newSplits });
  };

  const saveRolesToStorage = (
    newRoles: Record<string, "primary" | "backup">
  ) => {
    pushHistory();
    setEventRoles(newRoles);
    localStorage.setItem("nonstop_challenger_roles", JSON.stringify(newRoles));
    syncSettingsToCloud({ eventRoles: newRoles });
  };

  const saveOffsetsToStorage = (newOffsets: Record<string, number>) => {
    pushHistory();
    setEventOffsets(newOffsets);
    localStorage.setItem(
      "nonstop_challenger_offsets",
      JSON.stringify(newOffsets)
    );
    syncSettingsToCloud({ eventOffsets: newOffsets });
  };

  // 真正的多層復原：從歷史堆疊裡把最後一筆彈出，一路往回退
  const triggerUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const currentEvents = [...events];

    setEvents(last.events);
    syncEvents(last.events, currentEvents).catch((err) => {
      console.error("復原同步雲端失敗：", err);
      setAiNotice("⚠️ 復原已套用在畫面上，但同步到雲端失敗，請檢查網路連線。");
    });

    setTicketSplits(last.ticketSplits);
    localStorage.setItem(
      "nonstop_challenger_splits",
      JSON.stringify(last.ticketSplits)
    );

    setEventRoles(last.eventRoles);
    localStorage.setItem(
      "nonstop_challenger_roles",
      JSON.stringify(last.eventRoles)
    );

    setEventOffsets(last.eventOffsets);
    localStorage.setItem(
      "nonstop_challenger_offsets",
      JSON.stringify(last.eventOffsets)
    );

    syncSettingsToCloud({
      ticketSplits: last.ticketSplits,
      eventRoles: last.eventRoles,
      eventOffsets: last.eventOffsets,
    });

    const remaining = history.length - 1;
    setHistory((prev) => prev.slice(0, -1));

    setAiNotice(
      remaining > 0
        ? `↩️ 已復原！(還可以再復原 ${remaining} 步)`
        : "↩️ 已復原至最初的狀態！"
    );
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

  const {
    aiInput,
    setAiInput,
    isProcessing: isAiProcessing,
    handleProcessAiInput,
    handleKeyDownInput,
  } = useAiInputProcessor({
    events,
    setEvents,
    ticketSplits,
    setTicketSplits,
    eventOffsets,
    setEventOffsets,
    canUndo: history.length > 0,
    pushHistory,
    triggerUndo,
    setAiNotice,
    syncSettingsToCloud,
  });

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
      const cost = convertToTwd(
        oldEvent.expenses.reduce((sum, exp) => sum + exp.cost, 0),
        oldEvent.currency
      );
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

  // 手動調整卡片上的演出時間（例如官方公告時間有誤，或臨時異動）
  const handleDateChange = (id: string, newShowDate: string) => {
    const updated = events.map((event) =>
      event.id === id ? { ...event, showDate: newShowDate } : event
    );
    saveEventsToStorage(updated);
  };

  // 手動調整卡片上的預估費用（直接以單一項目覆蓋原本的 expenses 明細）
  const handleCostChange = (id: string, newTotalCost: number) => {
    const updated = events.map((event) =>
      event.id === id
        ? {
            ...event,
            expenses: [{ item: "手動調整費用", cost: newTotalCost }],
          }
        : event
    );
    saveEventsToStorage(updated);
  };

  // 變更卡片費用的原始幣別（例如原本記成台幣，改成日圓）
  const handleCurrencyChange = (id: string, newCurrency: string) => {
    const updated = events.map((event) =>
      event.id === id ? { ...event, currency: newCurrency } : event
    );
    saveEventsToStorage(updated, false);
  };

  // 使用者主動撤銷（刪除）一張卡片
  // 刪除卡片：改用「軟刪除」，卡片會被移到垃圾桶而不是直接消失
  // 因為之後要能任意順序翻出來復原，不適合用線性的 Ctrl+Z 處理，所以刪除這件事不會推進歷史堆疊
  // 調整分票資訊（總票數／分攤人數），數字微調不特別推進復原歷史，避免每按一下都佔一格
  const handleSplitChange = (
    eventId: string,
    field: "total" | "split",
    value: number
  ) => {
    const current = ticketSplits[eventId] || { total: 1, split: 1 };
    const updated = {
      ...ticketSplits,
      [eventId]: { ...current, [field]: Math.max(1, value) },
    };
    saveSplitsToStorage(updated, false);
  };

  const handleDeleteEvent = (id: string) => {
    const target = events.find((e) => e.id === id);
    const confirmed = confirm(
      `確定要刪除「${target?.title || "這張卡片"}」嗎？可以之後去垃圾桶復原。`
    );
    if (!confirmed) return;

    const updated = events.map((event) =>
      event.id === id ? { ...event, deletedAt: new Date().toISOString() } : event
    );
    saveEventsToStorage(updated, false);
    setAiNotice(`🗑️ 已將「${target?.title || "該活動"}」移入垃圾桶。`);
  };

  // 從垃圾桶復原一張卡片
  const handleRestoreEvent = (id: string) => {
    const updated = events.map((event) =>
      event.id === id ? { ...event, deletedAt: null } : event
    );
    saveEventsToStorage(updated, false);
    setAiNotice("♻️ 已從垃圾桶復原卡片。");
  };

  // 從垃圾桶永久刪除（這個動作沒辦法復原）
  const handlePermanentlyDeleteEvent = (id: string) => {
    const target = events.find((e) => e.id === id);
    const confirmed = confirm(
      `確定要永久刪除「${target?.title || "這張卡片"}」嗎？此動作無法復原！`
    );
    if (!confirmed) return;

    const updated = events.filter((event) => event.id !== id);
    saveEventsToStorage(updated, false);
    setAiNotice(`🗑️ 已永久刪除「${target?.title || "該活動"}」。`);
  };

  const availableOffsets = Array.from({ length: 27 }, (_, i) => i - 12);

  const handleResetData = () => {
    if (confirm("確定要重設回預設測試資料嗎？")) {
      pushHistory();

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
      const resetChecklist = [
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
      ];
      setChecklist(resetChecklist);
      setAlarms({});
      setRates({ TWD: 1, USD: 0.031, JPY: 4.85, EUR: 0.029 });
      syncSettingsToCloud({
        ticketSplits: { "event-yuuri-004": { total: 4, split: 2 } },
        eventOffsets: { "event-yuuri-004": 9, "event-fujii-kaze-002": 8 },
        eventRoles: {},
        checklist: resetChecklist,
        alarms: {},
      });
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
        !e.deletedAt &&
        (e.statusLifecycle === "purchased" ||
          e.statusLifecycle === "ticket_splitting")
    )
    .reduce(
      (sum, e) =>
        sum +
        convertToTwd(
          e.expenses.reduce((s, exp) => s + exp.cost, 0),
          e.currency
        ),
      0
    );

  const drawingExpenses = events
    .filter(
      (e) =>
        !e.deletedAt &&
        (e.statusLifecycle === "applied_drawing" ||
          e.statusLifecycle === "waiting_list")
    )
    .reduce(
      (sum, e) =>
        sum +
        convertToTwd(
          e.expenses.reduce((s, exp) => s + exp.cost, 0),
          e.currency
        ),
      0
    );

  const deletedEvents = events.filter((event) => !!event.deletedAt);

  const filteredEvents = events
    .filter((event) => {
      if (event.deletedAt) return false; // 垃圾桶裡的卡片不顯示在主列表
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

          {/* 垃圾桶 */}
          <button
            onClick={() => setIsTrashOpen(true)}
            className="relative text-xs px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300 hover:text-white transition-all flex items-center gap-1"
            title={lang === "zh" ? "垃圾桶" : "Trash Bin"}
          >
            <Trash2 size={13} />
            {deletedEvents.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {deletedEvents.length}
              </span>
            )}
          </button>

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
                  !e.deletedAt &&
                  (e.statusLifecycle === "purchased" ||
                    e.statusLifecycle === "applied_drawing")
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

          <button
            onClick={() => {
              // 匯出「目前篩選中的分類」底下，還沒被丟進垃圾桶的所有卡片（不限狀態）
              const targetEvents = events.filter(
                (e) =>
                  !e.deletedAt &&
                  (categoryFilter === "all" || e.type === categoryFilter)
              );
              const headers = [
                "專案",
                "分類",
                "藝人",
                "地點",
                "日期",
                "主辦",
                "狀態",
                "費用",
                "幣別",
              ];
              const rows = targetEvents.map((e) => [
                String(e.title || "").replace(/[=+\-@,]/g, ""),
                categoryLabels[e.type] || e.type,
                String(e.artist || "").replace(/[=+\-@,]/g, ""),
                String(e.location || "").replace(/[=+\-@,]/g, ""),
                e.showDate || "",
                e.agency || "",
                e.statusLifecycle || "",
                String(e.expenses.reduce((s, exp) => s + exp.cost, 0)),
                e.currency || "TWD",
              ]);

              const csvContent =
                "\uFEFF" +
                [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
              const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
              });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              const categoryName =
                categoryFilter === "all"
                  ? "全部分類"
                  : categoryLabels[categoryFilter] || categoryFilter;
              link.download = `${categoryName}_${
                new Date().toISOString().split("T")[0]
              }.csv`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1 text-[11px] text-cyan-300 hover:text-white hover:bg-cyan-900/30 border border-cyan-900/50 px-2 py-1.5 rounded-lg transition-all"
            title="匯出目前篩選分類底下的所有卡片"
          >
            <FileText size={12} />{" "}
            {lang === "zh"
              ? `匯出「${
                  categoryFilter === "all"
                    ? "全部分類"
                    : categoryLabels[categoryFilter] || categoryFilter
                }」`
              : "Export This Category"}
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
        <AiInputBar
          lang={lang}
          aiInput={aiInput}
          setAiInput={setAiInput}
          aiNotice={aiNotice}
          isProcessing={isAiProcessing}
          canUndo={history.length > 0}
          onProcess={handleProcessAiInput}
          onKeyDown={handleKeyDownInput}
          onUndo={triggerUndo}
        />

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
            <button
              onClick={() => setIsChartOpen((prev) => !prev)}
              className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border flex items-center gap-1 ${
                isChartOpen
                  ? "bg-purple-950 text-purple-300 border-purple-500"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
              }`}
            >
              <PieChart size={13} />
              {lang === "zh" ? "分類比例" : "Category Chart"}
            </button>
          </div>

          {isChartOpen && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <CategoryChart
                events={events}
                categoryLabels={categoryLabels}
                lang={lang}
              />
            </div>
          )}

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
                const isOffsetConfirmed = eventOffsets[event.id] !== undefined;
                const venueOffset = isOffsetConfirmed
                  ? eventOffsets[event.id]
                  : browserOffset;
                const alarmConfig = alarms[event.id] || {
                  enabled: false,
                  minutesAhead: 30,
                };
                const nativeCost = event.expenses.reduce(
                  (sum, exp) => sum + exp.cost,
                  0
                );
                const totalCost = convertToTwd(nativeCost, event.currency);
                const splitInfo = ticketSplits[event.id] || {
                  total: 1,
                  split: 1,
                };

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
                    isOffsetConfirmed={isOffsetConfirmed}
                    browserOffset={browserOffset}
                    availableOffsets={availableOffsets}
                    alarmConfig={alarmConfig}
                    totalCost={totalCost}
                    nativeCost={nativeCost}
                    currency={event.currency || "TWD"}
                    onCurrencyChange={handleCurrencyChange}
                    splitInfo={splitInfo}
                    onSplitChange={handleSplitChange}
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
                    onDateChange={handleDateChange}
                    onCostChange={handleCostChange}
                    onDelete={handleDeleteEvent}
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
          <span>
            {lang === "zh"
              ? "NONSTOP CHALLENGER 雲端同步已啟用"
              : "NONSTOP CHALLENGER CLOUD SYNC ACTIVE"}
          </span>
        </div>
      </footer>

      {isTrashOpen && (
        <TrashBin
          lang={lang}
          deletedEvents={deletedEvents}
          onClose={() => setIsTrashOpen(false)}
          onRestore={handleRestoreEvent}
          onPermanentlyDelete={handlePermanentlyDeleteEvent}
        />
      )}
    </div>
  );
}
