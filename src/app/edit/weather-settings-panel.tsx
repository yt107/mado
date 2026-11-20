"use client";

import { CloudSun, Info } from "lucide-react";

import { LocationSearch } from "@/components/location-search";
import { cx } from "@/lib/cx";
import {
  readWeatherSettings,
  type WeatherSettings,
} from "@/lib/widgets/weather";

import { CheckRow, PanelShell, RefreshSelect, Segmented } from "./panel-parts";

type Props = {
  settings: Record<string, unknown>;
  sizeLabel: string;
  onSettingsChange: (settings: WeatherSettings) => void;
  onClose: () => void;
};

// 背景の見本（画面設計「背景」）
const BACKGROUNDS: readonly (readonly [
  WeatherSettings["background"],
  string,
  string,
])[] = [
  ["auto", "天気に連動", "bg-linear-to-b from-weather-from to-weather-to"],
  ["dark", "ダーク", "bg-[#1b1d22]"],
  ["light", "ライト", "bg-white"],
  ["transparent", "透明", "bg-transparent"],
];

// 天気の設定（画面設計「ウィジェット設定（天気）」）
export function WeatherSettingsPanel({
  settings,
  sizeLabel,
  onSettingsChange,
  onClose,
}: Props) {
  const s = readWeatherSettings(settings);

  return (
    <PanelShell
      icon={CloudSun}
      iconColor="#3d72b4"
      title="天気の設定"
      subtitle={`${sizeLabel}・変更はすぐボードに反映`}
      onClose={onClose}
    >
      <section>
        <h3 className="mb-2 text-xs font-bold text-ink-2">地域</h3>
        <LocationSearch
          label="天気の地域"
          value={s.location}
          onChange={(location) => onSettingsChange({ ...s, location })}
        />
      </section>

      <section className="flex flex-col gap-2.5">
        <h3 className="text-xs font-bold text-ink-2">表示する情報</h3>
        <CheckRow
          label="時間ごとの予報"
          checked={s.showHourly}
          onChange={(showHourly) => onSettingsChange({ ...s, showHourly })}
        />
        <CheckRow
          label="週間予報（3日間）"
          checked={s.showDaily}
          onChange={(showDaily) => onSettingsChange({ ...s, showDaily })}
        />
        <CheckRow
          label="最高・最低気温"
          checked={s.showHighLow}
          onChange={(showHighLow) => onSettingsChange({ ...s, showHighLow })}
        />
        <CheckRow
          label="降水確率"
          checked={s.showPrecipitation}
          onChange={(showPrecipitation) =>
            onSettingsChange({ ...s, showPrecipitation })
          }
        />
      </section>

      <Segmented
        legend="温度の単位"
        value={s.unit}
        options={[
          ["celsius", "摂氏 °C"],
          ["fahrenheit", "華氏 °F"],
        ]}
        onChange={(unit) => onSettingsChange({ ...s, unit })}
      />

      <fieldset>
        <legend className="mb-2 text-xs font-bold text-ink-2">背景</legend>
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUNDS.map(([value, label, swatch]) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col items-center gap-1.5 text-[0.6875rem] text-ink-3 has-checked:text-ink"
            >
              <input
                type="radio"
                name="weather-background"
                value={value}
                checked={s.background === value}
                onChange={() => onSettingsChange({ ...s, background: value })}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cx(
                  "h-9 w-full rounded-lg border border-line peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                  swatch,
                )}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <RefreshSelect
        value={s.refreshMinutes}
        onChange={(refreshMinutes) =>
          onSettingsChange({ ...s, refreshMinutes })
        }
      />

      <p className="flex gap-1.5 text-xs leading-relaxed text-ink-3">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          天気データ：
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-ink"
          >
            Open-Meteo
          </a>
          （CC BY 4.0）
        </span>
      </p>
    </PanelShell>
  );
}
