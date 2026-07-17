export interface TicketStage {
  stageName: string;
  saleTime: string;
  status: "ended" | "drawing" | "purchased" | "active";
}

export interface FanEvent {
  id: string;
  title: string;
  location: string;
  type: "cafe" | "goods" | "gathering";
}

export interface CuratedShop {
  shopName: string;
  type: string;
  distance: string;
}

export interface ShowEvent {
  id: string;
  title: string;
  artist: string;
  type:
    | "official"
    | "fan_event"
    | "exhibition"
    | "ip_collab"
    | "doujin"
    | "seminar";
  location: string;
  showDate: string;
  agency: string;
  sourceUrl: string;
  statusLifecycle:
    | "watchlist"
    | "applied_drawing"
    | "purchased"
    | "ticket_splitting"
    | "waiting_list"
    | "ended_no_ticket";
  userNotes: string;
  expenses: { item: string; cost: number }[];
  ticketStages: TicketStage[];
  fanEvents: FanEvent[];
  curatedShops: CuratedShop[];
  // 軟刪除標記：不存在或 null 代表正常顯示，有值代表已被丟進垃圾桶（存刪除當下的時間）
  deletedAt?: string | null;
}

export const mockEvents: ShowEvent[] = [
  // 【💡 新手挑戰者核心功能實戰指引 - 語意教學完全體】
  {
    id: "event-guide-000",
    title: "💡 新手挑戰者核心功能實戰指引",
    artist: "Nonstop Challenger 開發顧問團隊",
    type: "official",
    location: "台北小巨蛋 (本卡片為您的操作沙盒)",
    showDate: "2026-07-29 18:30",
    agency: "產品設計指引 / 核心沙盒",
    sourceUrl: "https://github.com",
    statusLifecycle: "applied_drawing",
    userNotes:
      "【🚀 挑戰者三分鐘實戰沙盒】\n本卡片所有按鈕皆具備完整功能，您可以自由調整、手動切換狀態與時區！\n\n【📝 上方感測入口：語意精準辨識語法公式】\n請直接複製以下指令，貼到最上方的「語意動態感測入口」進行實測：\n\n1. ➡️ 自動新建卡片語法（參數請用逗號隔開）：\n   新建: 櫻坂46台北公演, 櫻坂46, 2026-11-20, 台北小巨蛋\n\n2. ➡️ 觸發中選狀態跳轉（自動扣減預備金）：\n   優里第一輪中選了！\n\n3. ➡️ 觸發落選狀態跳轉（自動觸發頂端解鎖安全鎖與資金釋放橫幅）：\n   完蛋優里落選了\n\n4. ➡️ 觸發分票功能（自動點亮實體分票追蹤計數器）：\n   要開始找阿華分票了\n\n5. ➡️ 防呆防反悔指令（撤銷剛才的操作，等同按 Ctrl+Z）：\n   復原",
    expenses: [{ item: "沙盒模擬測試規費", cost: 1200 }],
    ticketStages: [
      {
        stageName: "➡️ 公式 1：新建: [活動名稱], [主辦], [日期], [地點]",
        saleTime: "2026-07-15 12:00",
        status: "ended",
      },
      {
        stageName: "➡️ 公式 2：[歌手關鍵字] + [中選/落選/讓票/分票]",
        saleTime: "2026-07-29 18:30",
        status: "active",
      },
    ],
    fanEvents: [
      {
        id: "fe-guide-1",
        title: "新手體驗：探索周邊店",
        location: "小巨蛋周邊商圈",
        type: "goods",
      },
    ],
    curatedShops: [
      {
        shopName: "早秋咖啡 (示範店家)",
        type: "深夜咖啡/獨立選店",
        distance: "捷運步行 5 分鐘",
      },
    ],
  },
  // 預設優里卡片
  {
    id: "event-yuuri-004",
    title: "優里 Yuuri ARENA TOUR 2026 台北公演",
    artist: "優里 (Yuuri)",
    type: "official",
    location: "台北小巨蛋",
    showDate: "2026-07-29 18:30",
    agency: "大鴻藝術 BIG ART",
    sourceUrl: "https://ticketplus.com.tw",
    statusLifecycle: "applied_drawing",
    userNotes:
      "已經和阿華、老陳登記了 4 張特區抽選。日本歌手首度挑戰小巨蛋，希望能順利中選。如果沒中選，打字輸入「優里落選」看看會發生什麼事。",
    expenses: [
      { item: "特區票面價 (4張)", cost: 18400 },
      { item: "系統售票手續費", cost: 120 },
    ],
    ticketStages: [
      {
        stageName: "遠傳優先登記",
        saleTime: "2026-06-01 12:00",
        status: "ended",
      },
      {
        stageName: "官方第一輪抽選登記",
        saleTime: "2026-06-15 12:00",
        status: "ended",
      },
      {
        stageName: "抽選結果公佈與款項扣鎖",
        saleTime: "2026-07-29 18:30",
        status: "drawing",
      },
    ],
    fanEvents: [
      {
        id: "fe-yuuri-1",
        title: "優里台灣應援會：會場外限量手幅發放",
        location: "小巨蛋北廣場一號柱",
        type: "gathering",
      },
    ],
    curatedShops: [
      {
        shopName: "咖啡黑潮",
        type: "獨立咖啡館 / 音愛好者聚落",
        distance: "距離會場 850m",
      },
      {
        shopName: "記憶由書 BlockBOOKS",
        type: "獨立書店 / 藝術選品",
        distance: "距離會場 1.2km",
      },
    ],
  },
  // 預設藤井風卡片
  {
    id: "event-fujii-kaze-002",
    title: "藤井風 Fujii Kaze World Tour 2026 高雄公演",
    artist: "藤井風",
    type: "official",
    location: "高雄國家體育場 (世運主場館)",
    showDate: "2026-08-15 19:30",
    agency: "Live Nation Taiwan",
    sourceUrl: "https://tixcraft.com",
    statusLifecycle: "watchlist",
    userNotes:
      "這次竟然進攻世運主場館！一定要搶到搖滾區前排。地址在左營區，演出完可能要直接衝高鐵回台北，時間卡得非常緊。",
    expenses: [
      { item: "預估搖滾區票價", cost: 4800 },
      { item: "台北高雄來回高鐵票", cost: 2980 },
    ],
    ticketStages: [
      {
        stageName: "拓元售票系統全面開搶",
        saleTime: "2026-07-10 12:00",
        status: "active",
      },
    ],
    fanEvents: [],
    curatedShops: [],
  },
  // 預設法學研討會卡片
  {
    id: "event-leeandli-001",
    title: "202 digital 時代公司法與新興智慧財產規費公法研討會",
    artist: "理律法律事務所 / 台灣法學會",
    type: "seminar",
    location: "華山1914文化創意產業園區 東2四連棟",
    showDate: "2026-07-29 13:30",
    agency: "理律文教基金會",
    sourceUrl: "https://www.leeandli.com",
    statusLifecycle: "purchased",
    userNotes:
      "年度公司法管制更新研討會。雖然跟優里演唱會是同一天，但一個在下午（13:30），一個在晚上（18:30），多虧精準防撞系統，這屬於安全排程，不會跳出任何警告干擾我！",
    expenses: [{ item: "研討會報名費與講義規費", cost: 2500 }],
    ticketStages: [
      {
        stageName: "線上報名與規費繳納",
        saleTime: "2026-05-01 09:00",
        status: "ended",
      },
      {
        stageName: "電子出席證審查發放",
        saleTime: "2026-07-20 17:00",
        status: "purchased",
      },
    ],
    fanEvents: [],
    curatedShops: [],
  },
];
