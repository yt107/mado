import ICAL from "ical.js";

// iCal（.ics）を読み、決めた期間の予定を取り出す。
// 繰り返しの予定（毎週など）は、ical.js で1回ずつに展開する。例外（その回だけ時間を変えた、など）も反映する

export class CalendarParseError extends Error {
  constructor() {
    super("iCal の形式ではありません");
    this.name = "CalendarParseError";
  }
}

export type CalendarEventInstance = {
  uid: string;
  title: string;
  // 時刻のある予定は ISO 8601（UTC）、終日の予定は "YYYY-MM-DD"（end はその次の日）
  start: string;
  end: string;
  allDay: boolean;
};

export type ParsedCalendar = {
  name: string | null;
  events: CalendarEventInstance[];
};

// 1つのカレンダーで展開する回数の上限（長く続く毎日の予定などで、時間がかかりすぎないように）
const MAX_ITERATIONS = 20_000;
const MAX_EVENTS = 500;

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// その地域の時刻と UTC の差（ミリ秒）
function zoneOffset(utcMs: number, timeZone: string) {
  let format = offsetFormatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    offsetFormatters.set(timeZone, format);
  }
  const parts = Object.fromEntries(
    format.formatToParts(new Date(utcMs)).map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(
    parts.year ?? 0,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  return asUtc - utcMs;
}

// 「その地域での年月日と時刻」を、UTC の時刻に直す
function wallTimeToUtc(time: ICAL.Time, timeZone: string) {
  const guess = Date.UTC(
    time.year,
    time.month - 1,
    time.day,
    time.hour,
    time.minute,
    time.second,
  );
  const first = guess - zoneOffset(guess, timeZone);
  const second = guess - zoneOffset(first, timeZone);
  return new Date(second);
}

// ical.js の時刻を Date にする。地域の情報がない時刻（floating）は、
// TZID や X-WR-TIMEZONE に書かれた地域、それもなければ UTC として読む
function toInstant(time: ICAL.Time, fallbackZone: string | null): Date {
  const tzid = time.zone?.tzid;
  if (tzid && tzid !== "floating") {
    return time.toJSDate();
  }
  if (fallbackZone) {
    return wallTimeToUtc(time, fallbackZone);
  }
  return new Date(
    Date.UTC(
      time.year,
      time.month - 1,
      time.day,
      time.hour,
      time.minute,
      time.second,
    ),
  );
}

function dateString(time: ICAL.Time) {
  return `${String(time.year).padStart(4, "0")}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isCancelled(event: ICAL.Event) {
  const status = event.component.getFirstPropertyValue("status");
  return typeof status === "string" && status.toUpperCase() === "CANCELLED";
}

function readRoot(text: string): ICAL.Component {
  let jcal: unknown;
  try {
    jcal = ICAL.parse(text);
  } catch {
    throw new CalendarParseError();
  }
  // 1つのファイルに VCALENDAR が複数あるときは、最初のものを使う
  const first =
    Array.isArray(jcal) && Array.isArray(jcal[0]) ? jcal[0] : (jcal as unknown);
  if (!Array.isArray(first)) {
    throw new CalendarParseError();
  }
  const root = new ICAL.Component(first);
  if (root.name !== "vcalendar") {
    throw new CalendarParseError();
  }
  return root;
}

// カレンダーの名前だけを読む（登録するときに使う）
export function readCalendarName(text: string): string | null {
  const name = readRoot(text).getFirstPropertyValue("x-wr-calname");
  return typeof name === "string" && name.trim() !== "" ? name.trim() : null;
}

// rangeStart から rangeEnd までに重なる予定を、開始の早い順に返す
export function parseCalendar(
  text: string,
  rangeStart: Date,
  rangeEnd: Date,
): ParsedCalendar {
  const root = readRoot(text);
  const nameValue = root.getFirstPropertyValue("x-wr-calname");
  const zoneValue = root.getFirstPropertyValue("x-wr-timezone");
  const calendarZone = isTimeZone(zoneValue) ? zoneValue : null;

  // 繰り返しの元の予定と、その回だけ変えた予定（RECURRENCE-ID のあるもの）を分ける
  const masters = new Map<string, ICAL.Event>();
  const singles: ICAL.Event[] = [];
  const exceptions: ICAL.Event[] = [];
  for (const component of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    if (event.isRecurrenceException()) {
      exceptions.push(event);
    } else if (event.uid && !masters.has(event.uid)) {
      masters.set(event.uid, event);
    } else {
      singles.push(event);
    }
  }
  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (master?.isRecurring()) {
      master.relateException(exception);
    } else {
      singles.push(exception);
    }
  }

  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  const startDate = rangeStart.toISOString().slice(0, 10);
  const endDate = rangeEnd.toISOString().slice(0, 10);
  const events: CalendarEventInstance[] = [];
  let iterations = 0;

  function add(event: ICAL.Event, start: ICAL.Time, end: ICAL.Time | null) {
    if (isCancelled(event) || !start) return;
    const tzidParam = event.component
      .getFirstProperty("dtstart")
      ?.getParameter("tzid");
    const fallback = isTimeZone(tzidParam) ? tzidParam : calendarZone;
    const title = event.summary?.trim() || "（タイトルなし）";
    const uid = event.uid || title;

    if (start.isDate) {
      const from = dateString(start);
      let to = end?.isDate ? dateString(end) : addDays(from, 1);
      if (to <= from) to = addDays(from, 1);
      // 終日の予定は日付で比べる（どの地域で見ても入るように、期間は前後に広げてある）
      if (from < endDate && to > startDate) {
        events.push({ uid, title, start: from, end: to, allDay: true });
      }
      return;
    }

    const from = toInstant(start, fallback);
    const toTime = end ? toInstant(end, fallback) : from;
    const to = toTime.getTime() < from.getTime() ? from : toTime;
    if (
      from.getTime() < endMs &&
      Math.max(to.getTime(), from.getTime() + 1) > startMs
    ) {
      events.push({
        uid,
        title,
        start: from.toISOString(),
        end: to.toISOString(),
        allDay: false,
      });
    }
  }

  for (const event of [...masters.values(), ...singles]) {
    if (!event.startDate) continue;
    if (!event.isRecurring()) {
      add(event, event.startDate, event.endDate);
      continue;
    }
    const iterator = event.iterator();
    for (
      let next = iterator.next();
      next && iterations < MAX_ITERATIONS;
      next = iterator.next()
    ) {
      iterations++;
      const details = event.getOccurrenceDetails(next);
      const tzidParam = event.component
        .getFirstProperty("dtstart")
        ?.getParameter("tzid");
      const fallback = isTimeZone(tzidParam) ? tzidParam : calendarZone;
      // 期間より後になったら、それ以降の回は見なくてよい
      if (
        !details.startDate.isDate &&
        toInstant(next, fallback).getTime() >= endMs + 24 * 60 * 60 * 1000
      ) {
        break;
      }
      if (details.startDate.isDate && dateString(next) > addDays(endDate, 1)) {
        break;
      }
      add(details.item, details.startDate, details.endDate);
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return {
    name:
      typeof nameValue === "string" && nameValue.trim() !== ""
        ? nameValue.trim()
        : null,
    events: events.slice(0, MAX_EVENTS),
  };
}
