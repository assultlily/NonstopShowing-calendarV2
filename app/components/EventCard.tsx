import { useState } from "react";
import {
  MapPin,
  Navigation,
  Bell,
  BellOff,
  Map,
  Globe,
  AlertTriangle,
  Star,
  Shield,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { ShowEvent } from "../mockEvents";
import { AlarmConfig } from "../types";
import { LangType, TRANSLATIONS } from "../lib/translations";
import {
  getNavigationUrl,
  getEmbedMapIframeUrl,
  formatGmtLabel,
  getGoogleCalendarLink,
  showDateToInputValue,
  inputValueToShowDate,
  STATUS_BADGES,
} from "../lib/helpers";

interface EventCardProps {
  event: ShowEvent;
  isExpanded: boolean;
  onToggleExpand: () => void;
  lang: LangType;
  t: (typeof TRANSLATIONS)["zh"];
  categoryLabel: string;
  currentRole: "primary" | "backup" | null;
  conflicts: ShowEvent[];
  venueOffset: number;
  browserOffset: number;
  availableOffsets: number[];
  alarmConfig: AlarmConfig;
  totalCost: number;
  formatAmount: (amountInTWD: number) => string;
  convertToUserLocalTime: (venueTimeStr: string, venueOffset: number) => string;
  onToggleAlarm: (eventId: string) => void;
  onUpdateAlarmTime: (eventId: string, minutes: number) => void;
  onOffsetChange: (eventId: string, newOffset: number) => void;
  onSetPrimary: (eventId: string, conflictIds: string[]) => void;
  onSetBackup: (eventId: string) => void;
  onStatusChange: (
    eventId: string,
    status: ShowEvent["statusLifecycle"]
  ) => void;
  onNotesChange: (eventId: string, notes: string) => void;
  onDateChange: (eventId: string, newShowDate: string) => void;
  onCostChange: (eventId: string, newTotalCost: number) => void;
}

export default function EventCard({
  event,
  isExpanded,
  onToggleExpand,
  lang,
  t,
  categoryLabel,
  currentRole,
  conflicts,
  venueOffset,
  browserOffset,
  availableOffsets,
  alarmConfig,
  totalCost,
  formatAmount,
  convertToUserLocalTime,
  onToggleAlarm,
  onUpdateAlarmTime,
  onOffsetChange,
  onSetPrimary,
  onSetBackup,
  onStatusChange,
  onNotesChange,
  onDateChange,
  onCostChange,
}: EventCardProps) {
  const badge = STATUS_BADGES[event.statusLifecycle] || STATUS_BADGES.watchlist;
  const hasConflict = conflicts.length > 0;

  const [isEditingDate, setIsEditingDate] = useState(false);
  const [draftDate, setDraftDate] = useState(() =>
    showDateToInputValue(event.showDate)
  );
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [draftCost, setDraftCost] = useState(() => String(totalCost));

  const handleSaveDate = () => {
    if (draftDate) {
      onDateChange(event.id, inputValueToShowDate(draftDate));
    }
    setIsEditingDate(false);
  };

  const handleCancelDate = () => {
    setDraftDate(showDateToInputValue(event.showDate));
    setIsEditingDate(false);
  };

  const handleSaveCost = () => {
    const parsed = parseFloat(draftCost);
    if (!isNaN(parsed) && parsed >= 0) {
      onCostChange(event.id, parsed);
    }
    setIsEditingCost(false);
  };

  const handleCancelCost = () => {
    setDraftCost(String(totalCost));
    setIsEditingCost(false);
  };

  return (
    <div
      className={`bg-slate-900 rounded-xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-md hover:shadow-xl ${
        isExpanded
          ? "ring-1 ring-purple-500/50 border-purple-500/50 scale-[1.01]"
          : "border-slate-800"
      }`}
    >
      <div className="p-4 cursor-pointer" onClick={onToggleExpand}>
        {/* 卡片頭部 */}
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono tracking-wider">
              {categoryLabel?.toUpperCase()}
            </span>
            {currentRole === "primary" && (
              <span className="flex items-center gap-0.5 text-[10px] bg-amber-950 text-amber-400 border border-amber-900 px-1.5 py-0.5 rounded">
                <Star size={10} className="fill-amber-400" />{" "}
                {lang === "zh" ? "主案" : "Primary"}
              </span>
            )}
            {currentRole === "backup" && (
              <span className="flex items-center gap-0.5 text-[10px] bg-slate-950 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded">
                <Shield size={10} />{" "}
                {lang === "zh" ? "備案" : "Backup"}
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
                🏟️ {lang === "zh" ? "舉辦地時間" : "Venue Time"}
              </span>
              {isEditingDate ? (
                <span
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="datetime-local"
                    value={draftDate}
                    onChange={(e) => setDraftDate(e.target.value)}
                    className="bg-slate-900 border border-purple-500 rounded px-1 py-0.5 text-[10px] text-slate-200 font-mono focus:outline-none"
                  />
                  <button
                    onClick={handleSaveDate}
                    className="text-emerald-400 hover:text-emerald-300"
                    title={lang === "zh" ? "儲存" : "Save"}
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={handleCancelDate}
                    className="text-slate-500 hover:text-slate-300"
                    title={lang === "zh" ? "取消" : "Cancel"}
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : (
                <span className="font-mono text-slate-300 flex items-center gap-1">
                  {event.showDate.split(" ")[0]}{" "}
                  <span className="text-[9px] text-purple-400">
                    ({formatGmtLabel(venueOffset)})
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDraftDate(showDateToInputValue(event.showDate));
                      setIsEditingDate(true);
                    }}
                    className="text-slate-500 hover:text-purple-300 ml-0.5"
                    title={lang === "zh" ? "手動調整時間" : "Edit time"}
                  >
                    <Pencil size={10} />
                  </button>
                </span>
              )}
            </div>
            <div className="flex justify-between items-center text-emerald-400 font-medium text-[10px]">
              <span className="flex items-center gap-1 pl-4">
                🏠 {lang === "zh" ? "您的本地時間" : "Local Time"}
              </span>
              <span className="font-mono">
                {convertToUserLocalTime(event.showDate, venueOffset)}{" "}
                <span className="text-[8px] text-emerald-500">
                  ({formatGmtLabel(browserOffset)})
                </span>
              </span>
            </div>
          </div>

          {/* 金額調整（同一幣值） */}
          <div className="flex justify-between items-center pt-1 border-t border-slate-950/80 text-amber-400 font-mono">
            <span>
              💰 {lang === "zh" ? "預估規費/票面價" : "Est. Cost"}
            </span>
            {isEditingCost ? (
              <span
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="number"
                  min="0"
                  value={draftCost}
                  onChange={(e) => setDraftCost(e.target.value)}
                  className="w-20 bg-slate-900 border border-amber-500 rounded px-1 py-0.5 text-[10px] text-slate-200 font-mono focus:outline-none"
                />
                <button
                  onClick={handleSaveCost}
                  className="text-emerald-400 hover:text-emerald-300"
                  title={lang === "zh" ? "儲存" : "Save"}
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={handleCancelCost}
                  className="text-slate-500 hover:text-slate-300"
                  title={lang === "zh" ? "取消" : "Cancel"}
                >
                  <X size={12} />
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                {formatAmount(totalCost)}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDraftCost(String(totalCost));
                    setIsEditingCost(true);
                  }}
                  className="text-slate-500 hover:text-amber-300"
                  title={lang === "zh" ? "手動調整費用" : "Edit cost"}
                >
                  <Pencil size={10} />
                </button>
              </span>
            )}
          </div>
        </div>

        {/* 3小時時間防撞警告 */}
        {hasConflict && (
          <div className="mt-3 flex items-center gap-1.5 bg-rose-950/30 border border-rose-900/40 text-rose-400 px-2.5 py-1.5 rounded-lg text-[10px]">
            <AlertTriangle
              size={12}
              className="flex-shrink-0 animate-pulse text-rose-400"
            />
            <span>
              {t.conflictAlert} ({conflicts.length})
            </span>
          </div>
        )}

        {/* 一鍵導航 */}
        <div className="flex items-center justify-between mt-3 text-xs">
          <div className="flex items-center gap-1 text-slate-400 max-w-[70%]">
            <MapPin size={12} className="text-rose-400 flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
          <a
            href={getNavigationUrl(event.location)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800/80 px-2 py-1 rounded transition-all font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            <Navigation size={10} />{" "}
            {lang === "zh" ? "導航" : "Navigate"}
          </a>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-800 bg-slate-950/40 p-4 space-y-4 text-xs animate-fadeIn">
          {/* 鬧鐘控制面板 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px] text-slate-200 flex items-center gap-1">
                <Bell size={12} className="text-indigo-400" />
                {lang === "zh" ? "活動日程提示鬧鐘" : "Event Alarm Notification"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleAlarm(event.id);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium border transition-all ${
                  alarmConfig.enabled
                    ? "bg-indigo-950 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-500"
                }`}
              >
                {alarmConfig.enabled ? (
                  <>
                    <Bell size={10} /> {t.alarmSet}
                  </>
                ) : (
                  <>
                    <BellOff size={10} /> {t.alarmOff}
                  </>
                )}
              </button>
            </div>
            {alarmConfig.enabled && (
              <div className="flex items-center gap-2 mt-2 bg-slate-950 p-2 rounded border border-slate-800/80">
                <span className="text-slate-400 text-[10px]">
                  {t.alarmAhead}:
                </span>
                <select
                  value={alarmConfig.minutesAhead}
                  onChange={(e) =>
                    onUpdateAlarmTime(event.id, parseInt(e.target.value))
                  }
                  className="bg-slate-900 text-slate-300 border border-slate-800 rounded px-1 py-0.5 text-[10px]"
                >
                  <option value="10">10 {t.minutes}</option>
                  <option value="30">30 {t.minutes}</option>
                  <option value="60">1 {t.hours}</option>
                  <option value="120">2 {t.hours}</option>
                </select>
              </div>
            )}
          </div>

          {/* 地圖動態嵌入 */}
          <div className="space-y-2">
            <h4 className="text-slate-400 font-medium flex items-center gap-1">
              <Map size={12} className="text-purple-400" />
              {lang === "zh"
                ? "🗺️ 現地會場街景與周邊地圖"
                : "🏟️ Venue & Surrounding Map"}
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
                <Globe size={12} className="text-purple-400" />
                {lang === "zh" ? "🌍 舉辦地時區配置" : "🌍 Venue Timezone Settings"}
              </span>
              <select
                value={venueOffset}
                onChange={(e) =>
                  onOffsetChange(event.id, parseInt(e.target.value))
                }
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
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 同日行程 3 小時防撞調配 */}
          {hasConflict && (
            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3">
              <p className="font-semibold text-[11px] text-rose-400 flex items-center gap-1">
                <AlertTriangle size={12} />{" "}
                {lang === "zh"
                  ? "時間相近行程防撞調配"
                  : "Schedule Conflict Resolution"}
              </p>

              {/* 列出衝突的另一張／多張卡片，方便直接比對時間 */}
              <div className="mt-2 space-y-1.5">
                {conflicts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between bg-slate-950/60 border border-slate-800/60 rounded px-2 py-1.5 text-[10px]"
                  >
                    <span className="text-slate-300 truncate mr-2">
                      {c.title}
                    </span>
                    <span className="font-mono text-slate-500 flex-shrink-0">
                      {c.showDate.split(" ")[1] || c.showDate}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPrimary(
                      event.id,
                      conflicts.map((c) => c.id)
                    );
                  }}
                  className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-[10px] font-semibold border bg-amber-950/40 border-amber-500 text-amber-400"
                >
                  <Star size={10} className="fill-amber-400" />
                  {lang === "zh" ? "設為此時段主案" : "Set Primary"}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetBackup(event.id);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-[10px] font-semibold border bg-slate-900 border-slate-800 text-slate-400"
                >
                  <Shield size={10} />{" "}
                  {lang === "zh" ? "設為備案" : "Set Backup"}
                </button>
              </div>
            </div>
          )}

          {/* Google 日曆匯入 */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="font-semibold text-[11px] text-slate-200">
                  ⏱️ {lang === "zh" ? "日期追蹤管制" : "Timeline Tracking"}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {lang === "zh"
                    ? "匯入日曆時，系統會自動標註時區換算與連結資訊。"
                    : "Exports events with automatic timezone translations."}
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
                ➕{" "}
                {lang === "zh" ? "匯入 Google 日曆" : "Add to Google Calendar"}
              </a>
            </div>
          </div>

          {/* 變更狀態 */}
          <div className="flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
            <span className="font-medium text-slate-400">
              {lang === "zh" ? "變更活動狀態流程：" : "Change Lifecycle Stage:"}
            </span>
            <select
              value={event.statusLifecycle}
              onChange={(e) =>
                onStatusChange(
                  event.id,
                  e.target.value as ShowEvent["statusLifecycle"]
                )
              }
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              {Object.keys(STATUS_BADGES).map((statusKey) => (
                <option key={statusKey} value={statusKey}>
                  {STATUS_BADGES[statusKey].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h4 className="text-slate-400 font-medium flex items-center gap-1 mb-1">
              <FileText size={12} />{" "}
              {lang === "zh" ? "個人隨手彈性備註" : "Internal Notes"}
            </h4>
            <textarea
              value={event.userNotes}
              onChange={(e) => onNotesChange(event.id, e.target.value)}
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
            {lang === "zh" ? "官方情報網址" : "Official Info"}{" "}
            <ExternalLink size={10} />
          </a>
          <button
            onClick={onToggleExpand}
            className="text-slate-400 hover:text-slate-200 p-1 bg-slate-950/40 border border-slate-800 rounded-lg"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
