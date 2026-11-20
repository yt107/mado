"use client";

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  MapPin,
  Moon,
  Navigation,
  Sun,
  type LucideIcon,
} from "lucide-react";

import { SAMPLE_LOCATION, sampleForecast } from "@/lib/board/sample-remote";
import type { BoardWidget } from "@/lib/board/schema";
import { cx } from "@/lib/cx";
import { useNow } from "@/lib/hooks/use-now";
import { useRemoteData, type RemoteData } from "@/lib/hooks/use-remote-data";
import {
  fetchForecast,
  formatTemperature,
  readWeatherSettings,
  weatherInfo,
  type Forecast,
  type WeatherKind,
  type WeatherLocation,
  type WeatherSettings,
} from "@/lib/widgets/weather";

import { RemoteStatus } from "./remote-status";
import { useSampleMode } from "./sample-mode";

type Size = { w: number; h: number };

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// 天気（画面設計「ウィジェット一覧」の天気、「ウィジェット設定（天気）」）。
// 予報は端末のブラウザから Open-Meteo を読む（src/lib/widgets/weather.ts）
export function WeatherWidget({
  widget,
  size,
}: {
  widget: BoardWidget;
  size: Size;
}) {
  const settings = readWeatherSettings(widget.settings);
  return useSampleMode() ? (
    <SampleWeather settings={settings} size={size} />
  ) : (
    <LiveWeather settings={settings} size={size} />
  );
}

function SampleWeather({
  settings,
  size,
}: {
  settings: WeatherSettings;
  size: Size;
}) {
  const now = useNow();
  if (!now) return null;
  return (
    <WeatherView
      settings={settings}
      location={settings.location ?? SAMPLE_LOCATION}
      forecast={sampleForecast(now)}
      size={size}
    />
  );
}

function LiveWeather({
  settings,
  size,
}: {
  settings: WeatherSettings;
  size: Size;
}) {
  const { location } = settings;
  const state = useRemoteData(
    location
      ? `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`
      : null,
    (signal) =>
      location
        ? fetchForecast(location, signal)
        : Promise.reject(new Error("地域が設定されていません")),
    settings.refreshMinutes * 60_000,
  );

  if (!location) {
    return (
      <Message
        settings={settings}
        title="地域が未設定です"
        body="編集モードで天気の設定を開き、地域を選んでください"
      />
    );
  }
  if (!state.data) {
    return (
      <Message
        settings={settings}
        title={location.name}
        body={state.loading ? "読み込み中…" : "天気を読み込めませんでした"}
      />
    );
  }
  return (
    <WeatherView
      settings={settings}
      location={location}
      forecast={state.data}
      size={size}
      state={state}
    />
  );
}

// 天気の種類ごとの背景（「天気に連動」のとき。夜は紺にする）
const BACKGROUNDS: Record<WeatherKind | "night", [string, string]> = {
  clear: ["#3d72b4", "#192b4d"],
  partly: ["#3d72b4", "#192b4d"],
  cloudy: ["#5f6f86", "#283342"],
  fog: ["#6b7685", "#2c333d"],
  drizzle: ["#41566f", "#1a2431"],
  rain: ["#3b4d63", "#161f2b"],
  snow: ["#7d8fa6", "#36425a"],
  thunder: ["#3a3f5c", "#14162a"],
  night: ["#1f2d4f", "#0b1122"],
};

function Background({ code, isDay }: { code: number; isDay: boolean }) {
  const kind = weatherInfo(code).kind;
  const [from, to] =
    BACKGROUNDS[
      !isDay && (kind === "clear" || kind === "partly") ? "night" : kind
    ];
  return (
    <div
      aria-hidden
      // ウィジェットの余白の外まで塗る（.widget の padding と同じだけ広げる）
      className="absolute -inset-[calc(28px*var(--scale,1))] -z-10"
      style={{ background: `linear-gradient(to bottom, ${from}, ${to})` }}
    />
  );
}

const ICONS: Record<WeatherKind, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  thunder: CloudLightning,
};

export function WeatherIcon({
  code,
  isDay,
  className,
}: {
  code: number;
  isDay: boolean;
  className?: string;
}) {
  const { kind, label } = weatherInfo(code);
  const Icon = isDay
    ? ICONS[kind]
    : kind === "clear"
      ? Moon
      : kind === "partly"
        ? CloudMoon
        : ICONS[kind];
  return <Icon aria-label={label} className={className} strokeWidth={1.75} />;
}

function Message({
  settings,
  title,
  body,
}: {
  settings: WeatherSettings;
  title: string;
  body: string;
}) {
  return (
    <div className="relative flex h-full flex-col">
      {settings.background === "auto" && <Background code={2} isDay />}
      <p className="flex items-center gap-[0.4em] opacity-80">
        <MapPin aria-hidden className="size-[1em]" />
        <span className="truncate">{title}</span>
      </p>
      <p className="mt-auto text-[0.9em] leading-relaxed opacity-70">{body}</p>
    </div>
  );
}

type ViewProps = {
  settings: WeatherSettings;
  location: WeatherLocation;
  forecast: Forecast;
  size: Size;
  state?: RemoteData<Forecast>;
};

export function WeatherView({
  settings,
  location,
  forecast,
  size,
  state,
}: ViewProps) {
  const t = (celsius: number) => formatTemperature(celsius, settings.unit);
  const info = weatherInfo(forecast.code);
  const tall = size.h >= 2;
  const showHourly = settings.showHourly && forecast.hourly.length > 0;
  const showDaily = settings.showDaily && tall && forecast.daily.length > 0;
  // 横長の1行（2×1 など）は、右に時間ごとの予報を並べる
  const wideRow = !tall && size.w >= 2 && showHourly;

  const header = (
    <div className="flex items-center justify-between gap-[0.5em]">
      <p className="flex min-w-0 items-center gap-[0.4em] text-[0.95em] opacity-85">
        <Navigation aria-hidden className="size-[0.9em] shrink-0" />
        <span className="truncate">{location.name}</span>
      </p>
      {state?.error && <RemoteStatus state={state} />}
    </div>
  );

  const current = (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-[0.5em]">
        <p
          className="font-display leading-none font-extralight"
          style={{
            fontSize: tall
              ? "min(calc(96px * var(--scale, 1)), 32cqi, 20cqb)"
              : "min(calc(64px * var(--scale, 1)), 26cqi, 40cqb)",
          }}
        >
          {t(forecast.temperature)}
        </p>
        <WeatherIcon
          code={forecast.code}
          isDay={forecast.isDay}
          className="size-[2.6em] shrink-0"
        />
      </div>
      <p className="mt-[0.5em] truncate font-medium">{info.label}</p>
      {(settings.showHighLow || settings.showPrecipitation) &&
        forecast.today && (
          <p className="mt-[0.2em] truncate text-[0.9em] opacity-70">
            {settings.showHighLow &&
              `最高 ${t(forecast.today.max)} 最低 ${t(forecast.today.min)}`}
            {settings.showHighLow && settings.showPrecipitation && "　"}
            {settings.showPrecipitation &&
              forecast.today.precipitation !== null &&
              `降水 ${forecast.today.precipitation}%`}
          </p>
        )}
    </div>
  );

  const hourly = (
    <ol
      aria-label="時間ごとの予報"
      className="grid grid-cols-5 gap-[0.3em] text-center"
    >
      {forecast.hourly.map((hour) => (
        <li key={hour.hour} className="flex flex-col items-center gap-[0.35em]">
          <span className="text-[0.8em] opacity-70">
            {hour.isNow ? "今" : `${hour.hour}時`}
          </span>
          <WeatherIcon
            code={hour.code}
            isDay={hour.isDay}
            className="size-[1.35em]"
          />
          <span className="text-[0.9em]">{t(hour.temperature)}</span>
          {settings.showPrecipitation && hour.precipitation !== null && (
            <span className="text-[0.75em] opacity-60">
              {hour.precipitation}%
            </span>
          )}
        </li>
      ))}
    </ol>
  );

  return (
    <div className="relative flex h-full flex-col">
      {settings.background === "auto" && (
        <Background code={forecast.code} isDay={forecast.isDay} />
      )}
      {header}

      {wideRow ? (
        <div className="mt-[0.6em] flex min-h-0 flex-1 items-center gap-[1.2em]">
          <div className="w-[42%] shrink-0">{current}</div>
          <div className="min-w-0 flex-1">{hourly}</div>
        </div>
      ) : (
        <>
          <div className="mt-[0.6em]">{current}</div>
          <div className="min-h-0 flex-1" />
          {showHourly && tall && (
            <div className="border-t border-current/20 pt-[0.8em]">
              {hourly}
            </div>
          )}
          {showDaily && <DailyList forecast={forecast} settings={settings} />}
        </>
      )}
    </div>
  );
}

function DailyList({
  forecast,
  settings,
}: {
  forecast: Forecast;
  settings: WeatherSettings;
}) {
  const t = (celsius: number) => formatTemperature(celsius, settings.unit);
  const low = Math.min(...forecast.daily.map((day) => day.min));
  const high = Math.max(...forecast.daily.map((day) => day.max));
  const span = Math.max(high - low, 1);
  return (
    <ul
      aria-label="週間予報"
      className={cx(
        "mt-[0.8em] flex flex-col gap-[0.55em] border-t border-current/20 pt-[0.8em]",
      )}
    >
      {forecast.daily.map((day) => (
        <li
          key={day.weekday}
          className="grid grid-cols-[1.4em_1.6em_2.4em_1fr_2.4em] items-center gap-[0.5em] text-[0.9em]"
        >
          <span>{WEEKDAYS[day.weekday]}</span>
          <WeatherIcon code={day.code} isDay className="size-[1.2em]" />
          <span className="text-right opacity-60">{t(day.min)}</span>
          <span
            aria-hidden
            className="relative h-[0.3em] rounded-full bg-current/20"
          >
            <span
              className="absolute inset-y-0 rounded-full"
              style={{
                left: `${((day.min - low) / span) * 100}%`,
                right: `${((high - day.max) / span) * 100}%`,
                background: "linear-gradient(90deg, #8fd3ff, #ffc56b)",
              }}
            />
          </span>
          <span className="text-right">{t(day.max)}</span>
        </li>
      ))}
    </ul>
  );
}
