// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { decryptText, encryptText } from "@/server/encryption";
import {
  findFeedLink,
  looksLikeFeed,
  parseFeed,
  FeedParseError,
} from "@/server/sources/feed";
import {
  CalendarParseError,
  parseCalendar,
  readCalendarName,
} from "@/server/sources/ical";

// iCal のテキストを作る（行の区切りは CRLF）
function ics(...lines: string[]) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//test//EN",
    ...lines,
    "END:VCALENDAR",
  ].join("\r\n");
}

const TOKYO_TZ = [
  "BEGIN:VTIMEZONE",
  "TZID:Asia/Tokyo",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0900",
  "TZOFFSETTO:+0900",
  "TZNAME:JST",
  "DTSTART:19700101T000000",
  "END:STANDARD",
  "END:VTIMEZONE",
];

const range = (from: string, to: string) =>
  [new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`)] as const;

describe("iCal を読む", () => {
  test("時刻のある予定は、地域の時刻を UTC に直す", () => {
    const text = ics(
      "X-WR-CALNAME:仕事",
      ...TOKYO_TZ,
      "BEGIN:VEVENT",
      "UID:a",
      "SUMMARY:チーム定例",
      "DTSTART;TZID=Asia/Tokyo:20261106T100000",
      "DTEND;TZID=Asia/Tokyo:20261106T110000",
      "END:VEVENT",
    );
    const result = parseCalendar(text, ...range("2026-11-01", "2026-12-01"));
    expect(result.name).toBe("仕事");
    expect(result.events).toEqual([
      {
        uid: "a",
        title: "チーム定例",
        start: "2026-11-06T01:00:00.000Z",
        end: "2026-11-06T02:00:00.000Z",
        allDay: false,
      },
    ]);
  });

  test("VTIMEZONE がなくても、TZID の地域名で読む", () => {
    const text = ics(
      "BEGIN:VEVENT",
      "UID:b",
      "SUMMARY:歯医者",
      "DTSTART;TZID=Asia/Tokyo:20261106T133000",
      "DTEND;TZID=Asia/Tokyo:20261106T143000",
      "END:VEVENT",
    );
    const [event] = parseCalendar(
      text,
      ...range("2026-11-01", "2026-12-01"),
    ).events;
    expect(event?.start).toBe("2026-11-06T04:30:00.000Z");
  });

  test("地域のない時刻は、X-WR-TIMEZONE の地域で読む", () => {
    const text = ics(
      "X-WR-TIMEZONE:Asia/Tokyo",
      "BEGIN:VEVENT",
      "UID:c",
      "SUMMARY:ジム",
      "DTSTART:20261107T093000",
      "DTEND:20261107T110000",
      "END:VEVENT",
    );
    const [event] = parseCalendar(
      text,
      ...range("2026-11-01", "2026-12-01"),
    ).events;
    expect(event?.start).toBe("2026-11-07T00:30:00.000Z");
  });

  test("終日の予定は日付のまま返す（end は次の日）", () => {
    const text = ics(
      "BEGIN:VEVENT",
      "UID:d",
      "SUMMARY:燃えるゴミの日",
      "DTSTART;VALUE=DATE:20261107",
      "END:VEVENT",
    );
    expect(
      parseCalendar(text, ...range("2026-11-01", "2026-12-01")).events,
    ).toEqual([
      {
        uid: "d",
        title: "燃えるゴミの日",
        start: "2026-11-07",
        end: "2026-11-08",
        allDay: true,
      },
    ]);
  });

  test("繰り返しの予定を展開し、除いた日と、その回だけの変更を反映する", () => {
    const text = ics(
      ...TOKYO_TZ,
      "BEGIN:VEVENT",
      "UID:weekly",
      "SUMMARY:英会話",
      "DTSTART;TZID=Asia/Tokyo:20261002T190000",
      "DTEND;TZID=Asia/Tokyo:20261002T195000",
      "RRULE:FREQ=WEEKLY;BYDAY=FR",
      "EXDATE;TZID=Asia/Tokyo:20261113T190000",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:weekly",
      "RECURRENCE-ID;TZID=Asia/Tokyo:20261120T190000",
      "SUMMARY:英会話（振替）",
      "DTSTART;TZID=Asia/Tokyo:20261121T100000",
      "DTEND;TZID=Asia/Tokyo:20261121T105000",
      "END:VEVENT",
    );
    const events = parseCalendar(
      text,
      ...range("2026-11-01", "2026-12-01"),
    ).events;
    expect(events.map((e) => [e.title, e.start])).toEqual([
      ["英会話", "2026-11-06T10:00:00.000Z"],
      // 11/13 は除いた日。11/20 の回は 11/21 に動いた
      ["英会話（振替）", "2026-11-21T01:00:00.000Z"],
      ["英会話", "2026-11-27T10:00:00.000Z"],
    ]);
  });

  test("期間の外の予定と、取り消された予定は入れない", () => {
    const text = ics(
      "BEGIN:VEVENT",
      "UID:old",
      "SUMMARY:去年",
      "DTSTART:20251106T010000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:cancel",
      "SUMMARY:中止",
      "STATUS:CANCELLED",
      "DTSTART:20261106T010000Z",
      "END:VEVENT",
    );
    expect(
      parseCalendar(text, ...range("2026-11-01", "2026-12-01")).events,
    ).toEqual([]);
  });

  test("iCal でなければ CalendarParseError", () => {
    expect(() => readCalendarName("<html></html>")).toThrow(CalendarParseError);
    expect(() =>
      parseCalendar("BEGIN:VCARD\r\nEND:VCARD", new Date(), new Date()),
    ).toThrow(CalendarParseError);
  });
});

describe("フィードを読む", () => {
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>テストニュース</title>
<item><title>記事1</title><link>https://example.com/1</link>
<pubDate>Thu, 19 Nov 2026 12:32:00 +0900</pubDate><description>&lt;p&gt;本文&lt;/p&gt;</description>
<enclosure url="https://example.com/1.png" type="image/png" length="1"/></item>
<item><title>危ない</title><link>javascript:alert(1)</link></item>
<item><title>画像が http</title><link>https://example.com/2</link>
<enclosure url="http://example.com/2.png" type="image/png" length="1"/></item>
</channel></rss>`;

  test("RSS 2.0 の記事を、新しい形にそろえる", () => {
    const feed = parseFeed(rss, "https://example.com/feed");
    expect(feed.title).toBe("テストニュース");
    expect(feed.entries).toEqual([
      {
        title: "記事1",
        link: "https://example.com/1",
        publishedAt: "2026-11-19T03:32:00.000Z",
        image: "https://example.com/1.png",
        summary: "本文",
      },
      // javascript: のリンクは捨て、http の画像は使わない
      {
        title: "画像が http",
        link: "https://example.com/2",
        publishedAt: null,
        image: null,
        summary: "",
      },
    ]);
  });

  test("Atom と RSS 1.0（はてなの画像つき）も読める", () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title>
<entry><title>A</title><link rel="alternate" href="https://example.com/a"/><published>2026-11-19T00:00:00Z</published></entry></feed>`;
    expect(parseFeed(atom, "https://example.com/").entries[0]?.link).toBe(
      "https://example.com/a",
    );

    const rdf = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:hatena="http://www.hatena.ne.jp/info/xmlns#">
<channel rdf:about="https://b.hatena.ne.jp/"><title>はてブ</title></channel>
<item rdf:about="https://example.com/h"><title>H</title><link>https://example.com/h</link><hatena:imageurl>https://example.com/h.jpg</hatena:imageurl></item></rdf:RDF>`;
    const feed = parseFeed(rdf, "https://b.hatena.ne.jp/");
    expect(feed.title).toBe("はてブ");
    expect(feed.entries[0]?.image).toBe("https://example.com/h.jpg");
  });

  test("HTML はフィードではない", () => {
    const html = "<!doctype html><html><head></head><body>rss</body></html>";
    expect(looksLikeFeed(html)).toBe(false);
    expect(looksLikeFeed(rss)).toBe(true);
    expect(() => parseFeed(html, "https://example.com/")).toThrow(
      FeedParseError,
    );
  });

  test("サイトのページから、フィードの URL を探す", () => {
    const html = `<html><head>
<link rel="stylesheet" href="/a.css">
<link href="/feed?x=1&amp;y=2" rel="alternate" title="フィード" type="application/rss+xml">
</head></html>`;
    expect(findFeedLink(html, "https://zenn.dev/")).toBe(
      "https://zenn.dev/feed?x=1&y=2",
    );
    expect(findFeedLink("<html></html>", "https://zenn.dev/")).toBeNull();
  });
});

describe("暗号化", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_KEY", btoa("k".repeat(32)));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("暗号化して、元に戻せる。同じ値でも毎回ちがう暗号文になる", async () => {
    const url =
      "https://calendar.google.com/calendar/ical/x/private-y/basic.ics";
    const a = await encryptText(url);
    const b = await encryptText(url);
    expect(new TextDecoder().decode(a)).not.toContain("calendar.google.com");
    expect(a).not.toEqual(b);
    expect(await decryptText(a)).toBe(url);
  });

  test("書き換えられた暗号文や、ちがう鍵では戻せない", async () => {
    const data = await encryptText("secret");
    const tampered = data.slice();
    tampered[tampered.length - 1]! ^= 1;
    await expect(decryptText(tampered)).rejects.toThrow();

    vi.stubEnv("ENCRYPTION_KEY", btoa("z".repeat(32)));
    await expect(decryptText(data)).rejects.toThrow();
  });

  test("鍵がなければ、はっきりしたエラーにする", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    await expect(encryptText("x")).rejects.toThrow("ENCRYPTION_KEY");
  });
});
