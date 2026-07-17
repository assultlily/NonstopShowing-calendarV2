import { supabase } from "./supabaseClient";
import { ChecklistItem, AlarmConfig } from "../types";

export interface UserSettings {
  checklist: ChecklistItem[];
  alarms: Record<string, AlarmConfig>;
  ticketSplits: Record<string, { total: number; split: number }>;
  eventRoles: Record<string, "primary" | "backup">;
  eventOffsets: Record<string, number>;
}

const DEFAULT_SETTINGS: UserSettings = {
  checklist: [],
  alarms: {},
  ticketSplits: {},
  eventRoles: {},
  eventOffsets: {},
};

// 讀取目前登入者的設定（沒有資料列時回傳預設值，不會報錯）
export async function fetchUserSettings(): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) return DEFAULT_SETTINGS;

  return {
    checklist: data.checklist || [],
    alarms: data.alarms || {},
    ticketSplits: data.ticket_splits || {},
    eventRoles: data.event_roles || {},
    eventOffsets: data.event_offsets || {},
  };
}

// 把設定整包同步回 Supabase（單一使用者只會有一筆資料列，用 upsert 覆蓋）
export async function syncUserSettings(settings: UserSettings): Promise<void> {
  const { error } = await supabase.from("user_settings").upsert(
    {
      checklist: settings.checklist,
      alarms: settings.alarms,
      ticket_splits: settings.ticketSplits,
      event_roles: settings.eventRoles,
      event_offsets: settings.eventOffsets,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}
