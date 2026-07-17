export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  notes: string;
}

export interface AlarmConfig {
  enabled: boolean;
  minutesAhead: number; // 提前幾分鐘
}
