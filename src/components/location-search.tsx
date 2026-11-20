"use client";

import { LoaderCircle, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cx } from "@/lib/cx";
import {
  searchPlaces,
  type Place,
  type WeatherLocation,
} from "@/lib/widgets/weather";

type Props = {
  value: WeatherLocation | null;
  onChange: (location: WeatherLocation | null) => void;
  // 見出し（「天気の地域」など）。入力欄の名前として読み上げる
  label: string;
};

const SEARCH_DELAY_MS = 400;

// 天気の地域を選ぶ（初回の設定と、天気の設定パネルで使う）。
// 地名で検索するか、端末の現在地を使う。検索は端末のブラウザから Open-Meteo に送る
export function LocationSearch({ value, onChange, label }: Props) {
  const id = useId();
  const [editing, setEditing] = useState(value === null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [status, setStatus] = useState<"idle" | "searching" | "locating">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      controller.current?.abort();
    },
    [],
  );

  // 打ち終わるまで少し待ってから探す
  function search(text: string) {
    setQuery(text);
    setMessage(null);
    if (timer.current) clearTimeout(timer.current);
    controller.current?.abort();
    if (text.trim() === "") {
      setResults(null);
      setStatus("idle");
      return;
    }
    setStatus("searching");
    timer.current = setTimeout(async () => {
      const current = new AbortController();
      controller.current = current;
      try {
        const places = await searchPlaces(text, current.signal);
        if (current.signal.aborted) return;
        setResults(places);
      } catch {
        if (current.signal.aborted) return;
        setResults(null);
        setMessage("検索できませんでした。時間をおいてお試しください");
      } finally {
        if (!current.signal.aborted) setStatus("idle");
      }
    }, SEARCH_DELAY_MS);
  }

  function choose(place: Place) {
    onChange({
      name: place.name,
      region: place.region,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setEditing(false);
    setQuery("");
    setResults(null);
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setMessage("このブラウザでは現在地を使えません");
      return;
    }
    setStatus("locating");
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStatus("idle");
        onChange({
          // Open-Meteo には座標から地名を調べる機能がないので、「現在地」と出す
          name: "現在地",
          region: "",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setEditing(false);
        setQuery("");
        setResults(null);
      },
      () => {
        setStatus("idle");
        setMessage(
          "現在地を取得できませんでした。位置情報の利用を許可しているか確かめてください",
        );
      },
      { maximumAge: 10 * 60 * 1000, timeout: 15_000 },
    );
  }

  return (
    <div>
      {!editing && value ? (
        <div className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-card pr-1 pl-3">
          <MapPin aria-hidden className="size-4 shrink-0 text-ink-3" />
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            aria-label={`${label}：${value.region ? `${value.region} ` : ""}${value.name}（押すと変更）`}
            className="min-w-0 flex-1 truncate text-left"
          >
            {value.region && (
              <span className="mr-1.5 text-ink-2">{value.region}</span>
            )}
            {value.name}
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setEditing(true);
            }}
            aria-label="地域を外す"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-raised hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
          />
          <input
            ref={inputRef}
            id={`${id}-query`}
            type="search"
            value={query}
            aria-label={label}
            aria-describedby={`${id}-status`}
            autoComplete="off"
            placeholder="地名で検索（例：渋谷、札幌市）"
            onChange={(event) => search(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && value) {
                setEditing(false);
                setQuery("");
                setResults(null);
              }
            }}
            className="h-10 w-full rounded-[10px] border border-line bg-card pr-9 pl-9 placeholder:text-ink-3"
          />
          {status === "searching" && (
            <LoaderCircle
              aria-hidden
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ink-3"
            />
          )}
        </div>
      )}

      {editing && results && (
        <ul
          aria-label="検索の結果"
          className="mt-2 flex max-h-64 flex-col overflow-y-auto rounded-[10px] border border-line bg-card p-1"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-3">
              見つかりませんでした。「市」を付けたり、ローマ字で試してください
            </li>
          )}
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => choose(place)}
                className="flex w-full items-baseline gap-2 rounded-lg px-3 py-2 text-left hover:bg-raised"
              >
                <span className="font-medium">{place.name}</span>
                <span className="truncate text-xs text-ink-3">
                  {place.region}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={locateMe}
        disabled={status === "locating"}
        className="mt-2 flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-ink-2 hover:text-ink disabled:opacity-60"
      >
        {status === "locating" ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        ) : (
          <LocateFixed aria-hidden className="size-4" />
        )}
        現在地を使う
      </button>

      <p
        id={`${id}-status`}
        role="status"
        className={cx("mt-1 text-xs", message ? "text-danger" : "sr-only")}
      >
        {message ?? (results ? `${results.length}件見つかりました` : "")}
      </p>
    </div>
  );
}
