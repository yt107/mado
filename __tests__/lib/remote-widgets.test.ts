import { describe, expect, test } from "vitest";

import {
  calendarEventsQuerySchema,
  calendarRange,
  eventsOfSubscriptions,
  eventsOn,
  eventTimeLabel,
  monthGrid,
  weekdayLabels,
  type CalendarEvent,
} from "@/lib/widgets/calendar";
import {
  itemsOfFeeds,
  newsColumns,
  newsCount,
  updateNewsFeedSchema,
  type NewsItem,
} from "@/lib/widgets/news";
import { normalizeSettings } from "@/lib/widgets/settings";
import {
  forecastUrl,
  formatTemperature,
  mergePlaces,
  parseForecast,
  searchVariants,
  weatherInfo,
} from "@/lib/widgets/weather";

// テストは、端末の時刻（ローカル時刻）で日付を作る
const local = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min);

describe("天気", () => {
  test("設定の初期値（地域は東京）", () => {
    expect(normalizeSettings("weather", {})).toEqual({
      location: {
        name: "東京都",
        region: "",
        latitude: 35.6895,
        longitude: 139.69171,
      },
      showHourly: true,
      showDaily: true,
      showHighLow: true,
      showPrecipitation: false,
      unit: "celsius",
      background: "auto",
      refreshMinutes: 30,
    });
  });

  test("座標は小数2桁にして送る", () => {
    const url = new URL(
      forecastUrl({ latitude: 35.658912, longitude: 139.70665 }),
    );
    expect(url.searchParams.get("latitude")).toBe("35.66");
    expect(url.searchParams.get("longitude")).toBe("139.71");
    expect(url.searchParams.get("timezone")).toBe("auto");
  });

  test("Open-Meteo の答えを、今と2時間おきの予報、明日からの3日間にそろえる", () => {
    // 東京（UTC+9）の 2026-11-06 10:30。時刻は UNIX 秒
    const base = Date.UTC(2026, 10, 6, 0, 0) / 1000 - 9 * 3600;
    const hours = Array.from({ length: 48 }, (_, i) => base + i * 3600);
    const days = Array.from({ length: 5 }, (_, i) => base + i * 86400);
    const forecast = parseForecast({
      utc_offset_seconds: 9 * 3600,
      current: {
        time: base + 10.5 * 3600,
        temperature_2m: 18.4,
        weather_code: 2,
        is_day: 1,
      },
      hourly: {
        time: hours,
        temperature_2m: hours.map((_, i) => i),
        weather_code: hours.map(() => 1),
        precipitation_probability: hours.map(() => 10),
        is_day: hours.map(() => 1),
      },
      daily: {
        time: days,
        weather_code: [2, 61, 0, 2, 3],
        temperature_2m_max: [21, 16, 19, 20, 18],
        temperature_2m_min: [12, 11, 10, 12, 9],
        precipitation_probability_max: [10, 70, 0, 10, null],
      },
    });
    expect(forecast.temperature).toBe(18.4);
    expect(forecast.today).toEqual({ max: 21, min: 12, precipitation: 10 });
    expect(forecast.hourly.map((h) => [h.hour, h.isNow])).toEqual([
      [10, true],
      [12, false],
      [14, false],
      [16, false],
      [18, false],
    ]);
    // 「今」は、いまの値を使う
    expect(forecast.hourly[0]?.temperature).toBe(18.4);
    expect(forecast.hourly[1]?.temperature).toBe(12);
    // 2026-11-06 は金曜日。明日からの3日間（土・日・月）
    expect(forecast.daily.map((d) => [d.weekday, d.max, d.min])).toEqual([
      [6, 16, 11],
      [0, 19, 10],
      [1, 20, 12],
    ]);
  });

  test("温度の単位と、天気の言葉", () => {
    expect(formatTemperature(18.4, "celsius")).toBe("18°");
    expect(formatTemperature(18.4, "fahrenheit")).toBe("65°");
    expect(weatherInfo(2)).toEqual({ label: "晴れ時々くもり", kind: "partly" });
    expect(weatherInfo(63).kind).toBe("rain");
    expect(weatherInfo(1234).label).toBe("不明");
  });

  test("日本語の地名は、「市」を付けた形や外した形でも探す", () => {
    expect(searchVariants("札幌")).toEqual(["札幌", "札幌市"]);
    expect(searchVariants("渋谷区")).toEqual(["渋谷区", "渋谷"]);
    expect(searchVariants(" さいたま市 ")).toEqual(["さいたま市", "さいたま"]);
    // 東京は「東京都」、都道府県の名前は、その名前の市で探す
    expect(searchVariants("東京")).toEqual(["東京", "東京都"]);
    expect(searchVariants("大阪府")).toEqual(["大阪府", "大阪", "大阪市"]);
    expect(searchVariants("千葉県")).toEqual(["千葉県", "千葉", "千葉市"]);
    expect(searchVariants("京都")).toEqual(["京都", "京都市"]);
    expect(searchVariants("London")).toEqual(["London"]);
    expect(searchVariants("  ")).toEqual([]);
  });

  test("検索の結果をまとめ、人口の多い順に並べる", () => {
    const places = mergePlaces([
      [
        {
          id: 1,
          name: "横浜",
          latitude: 40,
          longitude: 141,
          population: 4412,
          country_code: "JP",
          admin1: "青森県",
          admin2: "上北郡",
        },
      ],
      [
        {
          id: 2,
          name: "横浜市",
          latitude: 35.4,
          longitude: 139.6,
          population: 3_700_000,
          feature_code: "PPLA",
          country_code: "JP",
          admin1: "神奈川県",
          admin2: "横浜市",
        },
        {
          id: 1,
          name: "横浜",
          latitude: 40,
          longitude: 141,
          population: 4412,
          country_code: "JP",
          admin1: "青森県",
          admin2: "上北郡",
        },
      ],
    ]);
    expect(places.map((p) => [p.name, p.region])).toEqual([
      ["横浜市", "神奈川県"],
      ["横浜", "青森県 上北郡"],
    ]);
  });
});

describe("カレンダー", () => {
  test("月表示のマス（日曜始まり・月曜始まり）", () => {
    // 2026年11月1日は日曜日
    const sunday = monthGrid(2026, 10, "sunday");
    expect(sunday[0]).toMatchObject({ date: "2026-11-01", inMonth: true });
    expect(sunday).toHaveLength(35);
    const monday = monthGrid(2026, 10, "monday");
    expect(monday[0]).toMatchObject({ date: "2026-10-26", inMonth: false });
    expect(monday.at(-1)).toMatchObject({ date: "2026-12-06", inMonth: false });
    expect(weekdayLabels("monday")[0]).toBe("月");
  });

  test("取り出す期間は、月表示のマスと明日まで", () => {
    expect(calendarRange(local(2026, 11, 19, 10), "sunday")).toEqual({
      from: "2026-11-01",
      to: "2026-12-05",
    });
  });

  test("その日にかかる予定（終日を先に）と、時刻の表し方", () => {
    const events: CalendarEvent[] = [
      {
        id: "a",
        subscriptionId: "s",
        title: "チーム定例",
        start: local(2026, 11, 6, 10).toISOString(),
        end: local(2026, 11, 6, 11).toISOString(),
        allDay: false,
      },
      {
        id: "b",
        subscriptionId: "s",
        title: "旅行",
        start: "2026-11-05",
        end: "2026-11-08",
        allDay: true,
      },
      {
        id: "c",
        subscriptionId: "s",
        title: "夜行バス",
        start: local(2026, 11, 6, 23).toISOString(),
        end: local(2026, 11, 7, 6).toISOString(),
        allDay: false,
      },
    ];
    expect(eventsOn(events, "2026-11-06").map((e) => e.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(eventsOn(events, "2026-11-08")).toEqual([]);
    expect(eventTimeLabel(events[0]!, "2026-11-06")).toBe("10:00 – 11:00");
    expect(eventTimeLabel(events[1]!, "2026-11-06")).toBe("終日");
    expect(eventTimeLabel(events[2]!, "2026-11-06")).toBe("23:00 –");
    expect(eventTimeLabel(events[2]!, "2026-11-07")).toBe("– 06:00");
  });

  test("期間の入力の確認", () => {
    expect(
      calendarEventsQuerySchema.safeParse({
        from: "2026-11-01",
        to: "2026-12-05",
      }).success,
    ).toBe(true);
    expect(
      calendarEventsQuerySchema.safeParse({
        from: "2026-12-05",
        to: "2026-11-01",
      }).success,
    ).toBe(false);
    expect(
      calendarEventsQuerySchema.safeParse({
        from: "2026-11-01",
        to: "2027-01-05",
      }).success,
    ).toBe(false);
  });

  test("消した購読先の予定は出さない", () => {
    const event = (id: string, subscriptionId: string): CalendarEvent => ({
      id,
      subscriptionId,
      title: id,
      start: "2026-11-06",
      end: "2026-11-07",
      allDay: true,
    });
    const events = [event("a", "s1"), event("b", "s2"), event("c", "s1")];
    expect(
      eventsOfSubscriptions(events, [{ id: "s1" }]).map((e) => e.id),
    ).toEqual(["a", "c"]);
    expect(eventsOfSubscriptions(events, [])).toEqual([]);
  });
});

describe("ニュース", () => {
  const item = (id: string, title: string, link: string): NewsItem => ({
    id,
    feedId: "f",
    title,
    link,
    publishedAt: null,
    image: null,
    summary: "",
  });

  test("設定の初期値", () => {
    expect(normalizeSettings("news", {})).toEqual({
      count: "auto",
      showImages: true,
      autoRotate: true,
      refreshMinutes: 15,
    });
    // なくした設定（同じ記事をまとめる）が残っていても、読み捨てる
    expect(normalizeSettings("news", { dedupe: false })).not.toHaveProperty(
      "dedupe",
    );
  });

  test("列に並べるのは、表示するフィードを並び順に、横のマスの数まで", () => {
    const feed = (id: string, sortOrder: number, visible = true) => ({
      id,
      sortOrder,
      visible,
    });
    const feeds = [feed("c", 2), feed("a", 0), feed("hidden", 1, false)];
    const ids = (width: number) => newsColumns(feeds, width).map((f) => f.id);
    expect(ids(1)).toEqual(["a"]);
    expect(ids(2)).toEqual(["a", "c"]);
    // フィードが横のマスより少なければ、その数だけ（列が広がる）
    expect(ids(4)).toEqual(["a", "c"]);
    expect(newsColumns([feed("hidden", 0, false)], 3)).toEqual([]);
  });

  test("フィードの変更は、名前・並び順・表示するかのどれかが要る", () => {
    expect(updateNewsFeedSchema.safeParse({ visible: false }).success).toBe(
      true,
    );
    expect(updateNewsFeedSchema.safeParse({ visible: "no" }).success).toBe(
      false,
    );
    expect(updateNewsFeedSchema.safeParse({}).success).toBe(false);
  });

  test("消したフィードの記事は出さない", () => {
    const items = [
      { ...item("1", "はてブの記事", "https://example.com/1"), feedId: "f1" },
      { ...item("2", "Qiita の記事", "https://example.com/2"), feedId: "f2" },
      { ...item("3", "はてブの記事2", "https://example.com/3"), feedId: "f1" },
    ];
    expect(itemsOfFeeds(items, [{ id: "f2" }]).map((i) => i.id)).toEqual(["2"]);
    expect(itemsOfFeeds(items, [])).toEqual([]);
  });

  test("「サイズに合わせる」の件数", () => {
    expect(newsCount("auto", 1, 1)).toBe(5);
    expect(newsCount("auto", 2, 1)).toBe(3);
    expect(newsCount("auto", 1, 2)).toBe(5);
    expect(newsCount("auto", 2, 3)).toBe(10);
    expect(newsCount("10", 1, 1)).toBe(10);
  });
});
