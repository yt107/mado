"use client";

import { Clock, Globe, Plus, X } from "lucide-react";
import { useId, useState } from "react";

import { cx } from "@/lib/cx";
import {
  CITIES,
  formatClockDate,
  gmtOffsetLabel,
  readClockSettings,
  type CityId,
  type ClockSettings,
} from "@/lib/widgets/clock";

type Props = {
  settings: Record<string, unknown>;
  sizeLabel: string;
  onChange: (settings: ClockSettings) => void;
  onClose: () => void;
};

const CITY_IDS = Object.keys(CITIES) as CityId[];

// 日付の形式。見本は、今日の日付で作る（基準のタイムゾーンの日付）
const DATE_FORMATS: ClockSettings["dateFormat"][] = [
  "monthDayWeekday",
  "yearMonthDayWeekday",
  "numeric",
];

const TEXT_STYLES: {
  value: ClockSettings["textStyle"];
  label: string;
  weight: string;
}[] = [
  { value: "thin", label: "細字", weight: "font-extralight" },
  { value: "regular", label: "標準", weight: "font-normal" },
  { value: "bold", label: "太字", weight: "font-semibold" },
];

function cityLabel(id: CityId) {
  const city = CITIES[id];
  return `${city.label}（${gmtOffsetLabel(city.timeZone, new Date())}）`;
}

// 時計の設定（画面設計「ウィジェット設定（時計）」）。変えるとすぐにボードに出て、自動で保存する
export function ClockSettingsPanel({
  settings,
  sizeLabel,
  onChange,
  onClose,
}: Props) {
  const s = readClockSettings(settings);
  const id = useId();
  const [adding, setAdding] = useState(false);

  function update(patch: Partial<ClockSettings>) {
    onChange({ ...s, ...patch });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-line px-5 py-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-raised">
          <Clock aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">時計の設定</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            {sizeLabel}・変更はすぐボードに反映
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="設定を閉じる"
          className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-raised hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5 text-sm">
        <fieldset>
          <legend className="mb-2 text-xs font-bold text-ink-2">
            時刻の表示形式
          </legend>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-raised p-1">
            {(
              [
                ["24h", "24時間"],
                ["12h", "12時間（午前/午後）"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="cursor-pointer rounded-lg px-2 py-2 text-center text-xs text-ink-2 has-checked:bg-card has-checked:font-bold has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-accent"
              >
                <input
                  type="radio"
                  name={`${id}-hour`}
                  value={value}
                  checked={s.hourCycle === value}
                  onChange={() => update({ hourCycle: value })}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3">
          <Switch
            label="秒を表示"
            checked={s.showSeconds}
            onChange={(showSeconds) => update({ showSeconds })}
          />
          <Switch
            label="日付を表示"
            note="横2マス以上で表示"
            checked={s.showDate}
            onChange={(showDate) => update({ showDate })}
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-date`}
            className="mb-2 block text-xs font-bold text-ink-2"
          >
            日付の形式
          </label>
          <select
            id={`${id}-date`}
            value={s.dateFormat}
            disabled={!s.showDate}
            onChange={(event) =>
              update({
                dateFormat: event.target.value as ClockSettings["dateFormat"],
              })
            }
            className="h-10 w-full rounded-[10px] border border-line bg-card px-3 disabled:opacity-50"
          >
            {DATE_FORMATS.map((value) => (
              <option key={value} value={value}>
                {formatClockDate(new Date(), CITIES[s.city].timeZone, value)}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-bold text-ink-2">
            文字のスタイル
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {TEXT_STYLES.map(({ value, label, weight }) => (
              <label
                key={value}
                className="cursor-pointer rounded-xl border border-line bg-card px-2 py-2.5 text-center has-checked:border-accent has-checked:bg-accent/10 has-focus-visible:outline-2 has-focus-visible:outline-accent"
              >
                <input
                  type="radio"
                  name={`${id}-style`}
                  value={value}
                  checked={s.textStyle === value}
                  onChange={() => update({ textStyle: value })}
                  className="sr-only"
                />
                <span className={cx("block font-display text-xl", weight)}>
                  10:30
                </span>
                <span className="mt-0.5 block text-[0.6875rem] text-ink-3">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <section aria-labelledby={`${id}-world`}>
          <h3
            id={`${id}-world`}
            className="mb-2 flex items-baseline gap-2 text-xs font-bold text-ink-2"
          >
            世界時計
            {/* 世界時計は、大きいとき（2×2 以上）だけ出す（clock-widget.tsx） */}
            <span className="font-normal text-ink-3">2×2 以上で表示</span>
          </h3>
          <ul className="flex flex-col gap-1.5">
            {s.worldClocks.map((city) => (
              <li
                key={city}
                className="flex items-center justify-between rounded-lg bg-raised py-1.5 pr-1.5 pl-3"
              >
                <span>{CITIES[city].label}</span>
                <span className="ml-auto text-xs text-ink-3">
                  {gmtOffsetLabel(CITIES[city].timeZone, new Date())}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      worldClocks: s.worldClocks.filter((c) => c !== city),
                    })
                  }
                  aria-label={`${CITIES[city].label}を外す`}
                  className="ml-2 grid size-7 place-items-center rounded-md text-ink-3 hover:bg-card hover:text-ink"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          {adding ? (
            <select
              aria-label="追加する都市"
              autoFocus
              defaultValue=""
              onChange={(event) => {
                const city = event.target.value as CityId;
                if (city) {
                  update({ worldClocks: [...s.worldClocks, city] });
                }
                setAdding(false);
              }}
              onBlur={() => setAdding(false)}
              className="mt-2 h-10 w-full rounded-[10px] border border-line bg-card px-3"
            >
              <option value="" disabled>
                都市を選ぶ
              </option>
              {CITY_IDS.filter(
                (city) => city !== s.city && !s.worldClocks.includes(city),
              ).map((city) => (
                <option key={city} value={city}>
                  {cityLabel(city)}
                </option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              disabled={s.worldClocks.length >= 4}
              onClick={() => setAdding(true)}
              className="mt-2 flex items-center gap-1.5 rounded-md px-1 py-1 text-xs font-bold text-accent-ink disabled:text-ink-3"
            >
              <Plus aria-hidden className="size-3.5" />
              都市を追加（最大4件）
            </button>
          )}
        </section>

        <div>
          <label
            htmlFor={`${id}-city`}
            className="mb-2 block text-xs font-bold text-ink-2"
          >
            基準のタイムゾーン
          </label>
          <div className="relative">
            <Globe
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
            />
            <select
              id={`${id}-city`}
              value={s.city}
              onChange={(event) =>
                update({
                  city: event.target.value as CityId,
                  // 基準にした都市は、世界時計から外す（同じ時刻が2つ並ばないように）
                  worldClocks: s.worldClocks.filter(
                    (c) => c !== event.target.value,
                  ),
                })
              }
              className="h-10 w-full rounded-[10px] border border-line bg-card pr-3 pl-9"
            >
              {CITY_IDS.map((city) => (
                <option key={city} value={city}>
                  {cityLabel(city)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-line px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-[10px] bg-ink px-5 text-sm font-bold text-canvas hover:opacity-90"
        >
          完了
        </button>
      </div>
    </div>
  );
}

// オンとオフの切り替え（チェックボックスを、スイッチとして読み上げる）。
// note は、名前の横に小さく出す補足（表示される条件など）
function Switch({
  label,
  note,
  checked,
  onChange,
}: {
  label: string;
  note?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="flex items-baseline gap-2">
        {label}
        {note && <span className="text-xs text-ink-3">{note}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-6 w-10 rounded-full bg-raised transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}
