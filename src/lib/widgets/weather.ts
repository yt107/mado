import * as z from "zod";

import { refreshMinutesSchema } from "./refresh";

// 天気の設定（widgets.settings）と、Open-Meteo（天気と地域の検索）の読み方。
// Open-Meteo は回数の上限を IP アドレスごとに数えるので、サーバーではなく端末のブラウザから呼ぶ
// （ほかの利用者と IP を共有するサーバーから呼ぶと、上限に早く当たるため）。
// データは CC BY 4.0。画面に出典（Open-Meteo）を出す

export const WEATHER_PLACE_NAME_MAX = 60;

export const weatherLocationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "地域の名前を入力してください")
    .max(WEATHER_PLACE_NAME_MAX, "地域の名前が長すぎます"),
  // 「東京都 渋谷区」など、地名の補足
  region: z.string().max(100).default(""),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type WeatherLocation = z.infer<typeof weatherLocationSchema>;

// 地域の初期値。最初から天気が出るように、東京にしておく
// （値は、地域の検索で「東京」を選んだときと同じ）
export const DEFAULT_WEATHER_LOCATION: WeatherLocation = {
  name: "東京都",
  region: "",
  latitude: 35.6895,
  longitude: 139.69171,
};

export const weatherSettingsSchema = z.object({
  location: weatherLocationSchema
    .nullable()
    .default(() => ({ ...DEFAULT_WEATHER_LOCATION })),
  // 表示する情報
  showHourly: z.boolean().default(true),
  showDaily: z.boolean().default(true),
  showHighLow: z.boolean().default(true),
  showPrecipitation: z.boolean().default(false),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  // 天気に連動（晴れ・くもり・雨・夜で色を変える）／ダーク／ライト／透明
  background: z.enum(["auto", "dark", "light", "transparent"]).default("auto"),
  refreshMinutes: refreshMinutesSchema(30),
});

export type WeatherSettings = z.infer<typeof weatherSettingsSchema>;

export function readWeatherSettings(settings: unknown): WeatherSettings {
  const result = weatherSettingsSchema.safeParse(settings);
  return result.success ? result.data : weatherSettingsSchema.parse({});
}

// ---- 天気の種類（WMO の天気コード） ----

export type WeatherKind =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder";

const WEATHER_CODES: Record<number, { label: string; kind: WeatherKind }> = {
  0: { label: "快晴", kind: "clear" },
  1: { label: "晴れ", kind: "clear" },
  2: { label: "晴れ時々くもり", kind: "partly" },
  3: { label: "くもり", kind: "cloudy" },
  45: { label: "霧", kind: "fog" },
  48: { label: "霧", kind: "fog" },
  51: { label: "霧雨", kind: "drizzle" },
  53: { label: "霧雨", kind: "drizzle" },
  55: { label: "強い霧雨", kind: "drizzle" },
  56: { label: "着氷性の霧雨", kind: "drizzle" },
  57: { label: "着氷性の霧雨", kind: "drizzle" },
  61: { label: "小雨", kind: "rain" },
  63: { label: "雨", kind: "rain" },
  65: { label: "大雨", kind: "rain" },
  66: { label: "着氷性の雨", kind: "rain" },
  67: { label: "着氷性の雨", kind: "rain" },
  71: { label: "小雪", kind: "snow" },
  73: { label: "雪", kind: "snow" },
  75: { label: "大雪", kind: "snow" },
  77: { label: "霧雪", kind: "snow" },
  80: { label: "にわか雨", kind: "rain" },
  81: { label: "にわか雨", kind: "rain" },
  82: { label: "激しいにわか雨", kind: "rain" },
  85: { label: "にわか雪", kind: "snow" },
  86: { label: "強いにわか雪", kind: "snow" },
  95: { label: "雷雨", kind: "thunder" },
  96: { label: "ひょうを伴う雷雨", kind: "thunder" },
  99: { label: "ひょうを伴う雷雨", kind: "thunder" },
};

export function weatherInfo(code: number): {
  label: string;
  kind: WeatherKind;
} {
  return WEATHER_CODES[code] ?? { label: "不明", kind: "cloudy" };
}

// ---- 天気予報（Open-Meteo の forecast API） ----

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// 座標は小数2桁（約1km）に丸めて送る。細かい位置を外に送らないため
export function forecastUrl(
  location: Pick<WeatherLocation, "latitude" | "longitude">,
) {
  const params = new URLSearchParams({
    latitude: location.latitude.toFixed(2),
    longitude: location.longitude.toFixed(2),
    current: "temperature_2m,weather_code,is_day",
    hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    timeformat: "unixtime",
    forecast_days: "5",
  });
  return `${FORECAST_URL}?${params}`;
}

const numberList = z.array(z.number().nullable());

const forecastResponseSchema = z.object({
  utc_offset_seconds: z.number(),
  current: z.object({
    time: z.number(),
    temperature_2m: z.number(),
    weather_code: z.number(),
    is_day: z.number(),
  }),
  hourly: z.object({
    time: z.array(z.number()),
    temperature_2m: numberList,
    weather_code: numberList,
    precipitation_probability: numberList,
    is_day: numberList,
  }),
  daily: z.object({
    time: z.array(z.number()),
    weather_code: numberList,
    temperature_2m_max: numberList,
    temperature_2m_min: numberList,
    precipitation_probability_max: numberList,
  }),
});

export type HourlyForecast = {
  // その地域の時刻での「時」。最初の1つは「今」
  hour: number;
  isNow: boolean;
  temperature: number;
  code: number;
  isDay: boolean;
  precipitation: number | null;
};

export type DailyForecast = {
  // その地域の日付での曜日（0 が日曜日）
  weekday: number;
  code: number;
  max: number;
  min: number;
  precipitation: number | null;
};

export type Forecast = {
  temperature: number;
  code: number;
  isDay: boolean;
  today: { max: number; min: number; precipitation: number | null } | null;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
};

// 時間ごとの予報は、今と、2時間おきに4つ（画面設計：今・12時・14時・16時・18時）
const HOURLY_COUNT = 5;
const HOURLY_STEP = 2;
// 週間予報は、明日から3日間
const DAILY_COUNT = 3;

export function parseForecast(json: unknown): Forecast {
  const data = forecastResponseSchema.parse(json);
  const offset = data.utc_offset_seconds;
  const localHour = (time: number) =>
    new Date((time + offset) * 1000).getUTCHours();
  const localWeekday = (time: number) =>
    new Date((time + offset) * 1000).getUTCDay();

  // 今の時刻を含む「時」から数える
  const { hourly } = data;
  const nowIndex = Math.max(
    0,
    hourly.time.findLastIndex((time) => time <= data.current.time),
  );
  const hours: HourlyForecast[] = [];
  for (let i = 0; i < HOURLY_COUNT; i++) {
    const index = nowIndex + i * HOURLY_STEP;
    const time = hourly.time[index];
    const temperature = hourly.temperature_2m[index];
    const code = hourly.weather_code[index];
    if (time === undefined || temperature == null || code == null) break;
    hours.push({
      hour: localHour(time),
      isNow: i === 0,
      temperature: i === 0 ? data.current.temperature_2m : temperature,
      code: i === 0 ? data.current.weather_code : code,
      isDay: i === 0 ? data.current.is_day === 1 : hourly.is_day[index] === 1,
      precipitation: hourly.precipitation_probability[index] ?? null,
    });
  }

  const { daily } = data;
  const days: DailyForecast[] = [];
  for (let index = 0; index < daily.time.length; index++) {
    const time = daily.time[index];
    const code = daily.weather_code[index];
    const max = daily.temperature_2m_max[index];
    const min = daily.temperature_2m_min[index];
    if (time === undefined || code == null || max == null || min == null) {
      continue;
    }
    days.push({
      weekday: localWeekday(time),
      code,
      max,
      min,
      precipitation: daily.precipitation_probability_max[index] ?? null,
    });
  }
  const [today, ...rest] = days;

  return {
    temperature: data.current.temperature_2m,
    code: data.current.weather_code,
    isDay: data.current.is_day === 1,
    today: today
      ? { max: today.max, min: today.min, precipitation: today.precipitation }
      : null,
    hourly: hours,
    daily: rest.slice(0, DAILY_COUNT),
  };
}

export async function fetchForecast(
  location: Pick<WeatherLocation, "latitude" | "longitude">,
  signal?: AbortSignal,
): Promise<Forecast> {
  const res = await fetch(forecastUrl(location), { signal });
  if (!res.ok) {
    throw new Error(`天気を読み込めませんでした（${res.status}）`);
  }
  return parseForecast(await res.json());
}

// 温度を、設定の単位にして丸める
export function formatTemperature(
  celsius: number,
  unit: WeatherSettings["unit"],
) {
  const value = unit === "fahrenheit" ? (celsius * 9) / 5 + 32 : celsius;
  return `${Math.round(value)}°`;
}

// ---- 地域の検索（Open-Meteo の geocoding API） ----

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

export type Place = {
  id: number;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
};

const geocodingResponseSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        feature_code: z.string().optional(),
        population: z.number().optional(),
        country: z.string().optional(),
        country_code: z.string().optional(),
        admin1: z.string().optional(),
        admin2: z.string().optional(),
      }),
    )
    .optional(),
});

type GeocodingResult = NonNullable<
  z.infer<typeof geocodingResponseSchema>["results"]
>[number];

// Open-Meteo は日本語の地名を名前そのままで探すので、「札幌」では見つからず「札幌市」なら見つかる、
// 「渋谷区」は見つからず「渋谷」なら見つかる、といったことがある。
// そこで、入力に「市」を付けた形と、「市・区・町・村」を取った形も一緒に探す。
// 都道府県の名前（「大阪府」など）では見つからないので、その名前の市（「大阪市」）を探す。
// 東京だけは「東京都」という名前で登録されている
export function searchVariants(query: string): string[] {
  const text = query.trim().replace(/\s+/g, " ");
  if (text === "") return [];
  const isJapanese = /[぀-ヿ㐀-鿿]/.test(text);
  if (!isJapanese) return [text];
  if (text === "東京") return [text, "東京都"];

  const prefecture = text.match(/^(.+)[府県]$/)?.[1];
  if (prefecture) return [text, prefecture, `${prefecture}市`];

  const stripped = text.replace(/[市区町村]$/, "");
  if (stripped !== text && stripped !== "") return [text, stripped];
  return [text, `${text}市`];
}

// 首都・県庁所在地などの順（同じ人口なら、大きな地名を先に出す）
const FEATURE_RANK: Record<string, number> = {
  PPLC: 0,
  PPLA: 1,
  PPLA2: 2,
  PPLA3: 3,
  PPLA4: 4,
  PPL: 5,
};

function regionOf(result: GeocodingResult) {
  const parts =
    result.country_code === "JP"
      ? [result.admin1, result.admin2]
      : [result.admin1, result.country];
  return parts
    .filter((part): part is string => !!part && part !== result.name)
    .join(" ");
}

// いくつかの検索の結果をまとめ、人口の多い順に並べる
export function mergePlaces(lists: GeocodingResult[][], limit = 8): Place[] {
  const byId = new Map<number, GeocodingResult>();
  for (const list of lists) {
    for (const result of list) {
      if (!byId.has(result.id)) byId.set(result.id, result);
    }
  }
  return [...byId.values()]
    .sort(
      (a, b) =>
        (b.population ?? 0) - (a.population ?? 0) ||
        (FEATURE_RANK[a.feature_code ?? ""] ?? 9) -
          (FEATURE_RANK[b.feature_code ?? ""] ?? 9),
    )
    .slice(0, limit)
    .map((result) => ({
      id: result.id,
      name: result.name,
      region: regionOf(result),
      latitude: result.latitude,
      longitude: result.longitude,
    }));
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  const lists = await Promise.all(
    searchVariants(query).map(async (name) => {
      const params = new URLSearchParams({
        name,
        count: "10",
        language: "ja",
        format: "json",
      });
      const res = await fetch(`${GEOCODING_URL}?${params}`, { signal });
      if (!res.ok) {
        throw new Error(`地域を検索できませんでした（${res.status}）`);
      }
      return geocodingResponseSchema.parse(await res.json()).results ?? [];
    }),
  );
  return mergePlaces(lists);
}
