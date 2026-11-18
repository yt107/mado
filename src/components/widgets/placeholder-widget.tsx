import { WIDGET_LABELS, type WidgetType } from "@/lib/widgets/types";

import { WIDGET_ICONS } from "./widget-icon";

// まだ中身を作っていないウィジェット。配置が分かるように、アイコンと名前だけを出す
export function PlaceholderWidget({ type }: { type: WidgetType }) {
  const Icon = WIDGET_ICONS[type];
  return (
    <div className="flex h-full flex-col justify-between">
      <p className="flex items-center gap-[0.5em] font-medium opacity-80">
        <Icon aria-hidden className="size-[1.1em] shrink-0" />
        {WIDGET_LABELS[type]}
      </p>
      <p className="text-[0.85em] opacity-60">準備中</p>
    </div>
  );
}
