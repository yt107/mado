import {
  CalendarDays,
  Clock,
  CloudSun,
  Hourglass,
  ListTodo,
  Newspaper,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

import type { WidgetType } from "@/lib/widgets/types";

// ウィジェットの種類ごとのアイコン（画面設計のウィジェット一覧に合わせる）
export const WIDGET_ICONS: Record<WidgetType, LucideIcon> = {
  clock: Clock,
  weather: CloudSun,
  calendar: CalendarDays,
  todo: ListTodo,
  memo: StickyNote,
  countdown: Hourglass,
  news: Newspaper,
};
