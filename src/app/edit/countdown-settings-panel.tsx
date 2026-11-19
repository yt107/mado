"use client";

import {
  CalendarDays,
  Hourglass,
  Info,
  MessageCircle,
  Type,
} from "lucide-react";
import { useId } from "react";

import {
  COUNTDOWN_SUFFIX_MAX,
  COUNTDOWN_TITLE_MAX,
  localDateString,
  readCountdownSettings,
  type CountdownSettings,
} from "@/lib/widgets/countdown";

import { PanelShell, Segmented, Switch } from "./panel-parts";

type Props = {
  settings: Record<string, unknown>;
  sizeLabel: string;
  // 文字を打っているあいだは、少し待ってから保存する（debounce）
  onSettingsChange: (
    settings: CountdownSettings,
    options?: { debounce?: boolean },
  ) => void;
  onClose: () => void;
};

// カウントダウンの設定（画面設計「ウィジェット設定（カウントダウン）」）
export function CountdownSettingsPanel({
  settings,
  sizeLabel,
  onSettingsChange,
  onClose,
}: Props) {
  const s = readCountdownSettings(settings);
  const id = useId();

  return (
    <PanelShell
      icon={Hourglass}
      iconColor="#e0872f"
      title="カウントダウンの設定"
      subtitle={`${sizeLabel}・変更はすぐボードに反映`}
      onClose={onClose}
    >
      <TextField
        id={`${id}-title`}
        label="イベント名"
        icon={Type}
        value={s.title}
        maxLength={COUNTDOWN_TITLE_MAX}
        placeholder="京都旅行"
        onChange={(title) =>
          onSettingsChange({ ...s, title }, { debounce: true })
        }
      />

      <div>
        <label
          htmlFor={`${id}-date`}
          className="mb-2 block text-xs font-bold text-ink-2"
        >
          日付
        </label>
        <div className="relative">
          <CalendarDays
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
          />
          <input
            id={`${id}-date`}
            type="date"
            value={s.date ?? ""}
            onChange={(event) => {
              const date = event.target.value || null;
              onSettingsChange({
                ...s,
                date,
                // 進み具合のバーは、日付を設定した日から数える
                startDate: date ? localDateString(new Date()) : null,
              });
            }}
            className="h-10 w-full rounded-[10px] border border-line bg-card pr-3 pl-9"
          />
        </div>
      </div>

      <TextField
        id={`${id}-suffix`}
        label="日付のあとに表示する言葉（任意）"
        icon={MessageCircle}
        value={s.suffix}
        maxLength={COUNTDOWN_SUFFIX_MAX}
        placeholder="出発"
        onChange={(suffix) =>
          onSettingsChange({ ...s, suffix }, { debounce: true })
        }
      />

      <Segmented
        legend="表示"
        value={s.unit}
        options={[
          ["days", "日数"],
          ["daysHours", "日数と時間"],
        ]}
        onChange={(unit) => onSettingsChange({ ...s, unit })}
      />

      <Switch
        label="進み具合のバーを表示"
        checked={s.showProgress}
        onChange={(showProgress) => onSettingsChange({ ...s, showProgress })}
      />

      <p className="flex gap-1.5 text-xs leading-relaxed text-ink-3">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        バーは、設定した日から当日までの進み具合を表します。当日は「今日」と表示します。
      </p>
    </PanelShell>
  );
}

function TextField({
  id,
  label,
  icon: Icon,
  value,
  maxLength,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  icon: typeof Type;
  value: string;
  maxLength: number;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-bold text-ink-2">
        {label}
      </label>
      <div className="relative">
        <Icon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
        />
        <input
          id={id}
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-[10px] border border-line bg-card pr-3 pl-9 placeholder:text-ink-3"
        />
      </div>
    </div>
  );
}
