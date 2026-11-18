// ウィジェットの種類（er.md の widget_type）

export const WIDGET_TYPES = [
  "clock",
  "weather",
  "calendar",
  "todo",
  "memo",
  "countdown",
  "news",
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

// 編集モードの一覧に出す説明（画面設計のウィジェット一覧）
export const WIDGET_DESCRIPTIONS: Record<WidgetType, string> = {
  clock: "時刻・日付・世界時計",
  weather: "現在の天気と週間予報",
  calendar: "月表示と今日の予定",
  todo: "やることリスト",
  memo: "付箋のような手書きメモ",
  countdown: "イベントまでの日数",
  news: "RSS・ヘッドライン",
};

// 一覧から置くときの大きさ（列×行。画面設計のウィジェット一覧）
export const DEFAULT_SIZES: Record<WidgetType, { w: number; h: number }> = {
  clock: { w: 2, h: 2 },
  weather: { w: 1, h: 2 },
  calendar: { w: 1, h: 3 },
  todo: { w: 1, h: 1 },
  memo: { w: 1, h: 1 },
  countdown: { w: 1, h: 1 },
  news: { w: 1, h: 2 },
};

export const WIDGET_LABELS: Record<WidgetType, string> = {
  clock: "時計",
  weather: "天気",
  calendar: "カレンダー",
  todo: "ToDo",
  memo: "メモ",
  countdown: "カウントダウン",
  news: "ニュース",
};
