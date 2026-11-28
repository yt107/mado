import type {
  CalendarEventsResponse,
  CalendarSubscription,
} from "../widgets/calendar";
import type { NewsFeed, NewsItemsResponse } from "../widgets/news";
import type { Forecast, WeatherLocation } from "../widgets/weather";

// 見本のボードで出す、天気・予定・ニュースの見本（画面設計の例に合わせる）。
// 時刻は、見ている端末の今に合わせて作る

export const SAMPLE_LOCATION: WeatherLocation = {
  name: "渋谷区",
  region: "東京都",
  latitude: 35.66,
  longitude: 139.7,
};

export function sampleForecast(now: Date): Forecast {
  const hour = now.getHours();
  const temperatures = [18, 20, 21, 19, 16];
  const codes = [2, 1, 1, 3, 2];
  return {
    temperature: 18,
    code: 2,
    isDay: hour >= 6 && hour < 18,
    today: { max: 21, min: 12, precipitation: 10 },
    hourly: temperatures.map((temperature, i) => {
      const at = (hour + i * 2) % 24;
      return {
        hour: at,
        isNow: i === 0,
        temperature,
        code: codes[i] ?? 2,
        isDay: at >= 6 && at < 18,
        precipitation: [10, 0, 0, 20, 10][i] ?? null,
      };
    }),
    daily: [
      { code: 61, min: 11, max: 16, precipitation: 70 },
      { code: 0, min: 10, max: 19, precipitation: 0 },
      { code: 2, min: 12, max: 20, precipitation: 10 },
    ].map((day, i) => ({ ...day, weekday: (now.getDay() + i + 1) % 7 })),
  };
}

const status = { lastFetchedAt: null, lastError: null };

export const SAMPLE_SUBSCRIPTIONS: CalendarSubscription[] = [
  { id: "work", name: "仕事", color: "blue", ...status },
  { id: "family", name: "家族", color: "green", ...status },
  { id: "lesson", name: "習いごと", color: "purple", ...status },
  { id: "home", name: "暮らし", color: "orange", ...status },
];

export function sampleCalendar(now: Date): CalendarEventsResponse {
  const at = (days: number, hour: number, minute = 0) =>
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + days,
      hour,
      minute,
    ).toISOString();
  const date = (days: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const timed = (
    id: string,
    subscriptionId: string,
    title: string,
    days: number,
    from: [number, number],
    to: [number, number],
  ) => ({
    id,
    subscriptionId,
    title,
    start: at(days, ...from),
    end: at(days, ...to),
    allDay: false,
  });
  return {
    subscriptions: SAMPLE_SUBSCRIPTIONS,
    events: [
      timed("1", "work", "チーム定例", 0, [10, 0], [11, 0]),
      timed("2", "family", "歯医者", 0, [13, 30], [14, 30]),
      timed("3", "lesson", "オンライン英会話", 0, [19, 0], [19, 50]),
      {
        id: "4",
        subscriptionId: "home",
        title: "燃えるゴミの日",
        start: date(1),
        end: date(2),
        allDay: true,
      },
      timed("5", "work", "ジム", 1, [9, 30], [11, 0]),
      timed("6", "work", "打ち合わせ", 3, [15, 0], [16, 0]),
      timed("7", "family", "美容院", 6, [11, 0], [12, 0]),
      timed("8", "lesson", "オンライン英会話", 7, [19, 0], [19, 50]),
      timed("9", "work", "締め切り", 12, [17, 0], [18, 0]),
    ],
    // 見本は押しても開かない
    googleCalendars: [],
  };
}

const SAMPLE_FEEDS: NewsFeed[] = [
  ["news", "ニュース速報"],
  ["tech", "テックニュース"],
  ["dev", "開発ブログ"],
  ["cloud", "クラウド情報"],
].map(([id = "", title = ""], sortOrder) => ({
  id,
  title,
  feedUrl: "https://example.com/feed",
  sortOrder,
  visible: true,
  ...status,
}));

// フィードごとの見出しと、何分前の記事か。列に並べるので、どのフィードにも数件ずつ置く
const SAMPLE_HEADLINES: Record<string, [string, number][]> = {
  news: [
    ["各地で紅葉が見頃に 週末は行楽日和の予想", 12],
    ["来週は寒気の影響で各地の気温が下がる見込み", 95],
    ["年末年始の帰省ラッシュ、ピークは12月29日ごろ", 160],
    ["駅前の再開発で新しい図書館が来春オープン", 240],
    ["インフルエンザの流行入り 早めの予防接種を", 330],
  ],
  tech: [
    ["家庭用スマートディスプレイ市場、前年から拡大", 38],
    ["新しいタブレット向けの省電力モードが公開", 110],
    ["電子ペーパーの大型ディスプレイ、価格が下がる", 200],
    ["ブラウザの新機能で、ページの読み込みがより速く", 290],
  ],
  dev: [
    ["Hono + Drizzle で作る型安全な REST API 入門", 60],
    ["React のサーバーコンポーネントを実務で使う", 150],
    ["CSS のコンテナクエリで作るレスポンシブなカード", 260],
    ["テストを速くする、小さな工夫のまとめ", 380],
  ],
  cloud: [
    ["サーバーレス環境から PostgreSQL に接続するときの注意点", 120],
    ["コンテナのデプロイを自動化する手順", 210],
    ["小さく始めるクラウドの費用の見直し方", 310],
    ["マネージド DB のバックアップと復元を試す", 420],
  ],
};

export function sampleNews(now: Date): NewsItemsResponse {
  return {
    feeds: SAMPLE_FEEDS,
    items: Object.entries(SAMPLE_HEADLINES).flatMap(([feedId, headlines]) =>
      headlines.map(([title, minutes], index) => ({
        id: `${feedId}-${index}`,
        feedId,
        title,
        link: `https://example.com/${feedId}/${index}`,
        publishedAt: new Date(now.getTime() - minutes * 60_000).toISOString(),
        image: null,
        summary: "",
      })),
    ),
  };
}
