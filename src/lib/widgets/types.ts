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

export const WIDGET_LABELS: Record<WidgetType, string> = {
  clock: "時計",
  weather: "天気",
  calendar: "カレンダー",
  todo: "ToDo",
  memo: "メモ",
  countdown: "カウントダウン",
  news: "ニュース",
};
