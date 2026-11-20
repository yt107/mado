import { and, asc, eq } from "drizzle-orm";
import type * as z from "zod";

import {
  CALENDAR_COLOR_KEYS,
  CALENDAR_NAME_MAX,
  CALENDAR_SUBSCRIPTIONS_MAX,
  calendarSubscriptionSchema,
  type CalendarColor,
  type CalendarEvent,
  type CalendarEventsResponse,
  type CalendarSubscription,
  type updateCalendarSubscriptionSchema,
} from "@/lib/widgets/calendar";

import { db } from "../db";
import { boards, calendarSubscriptions, widgets } from "../db/schema";
import { decryptText, encryptText } from "../encryption";
import { parsePublicUrl, safeFetch } from "../net/safe-fetch";
import { parseCalendar, readCalendarName } from "../sources/ical";
import { isFetchFailure, toWidgetError } from "./fetch-errors";
import {
  fail,
  findOwnedWidget,
  lockOwnedWidget,
  ok,
  wrongType,
  type Result,
  type Tx,
} from "./widgets";

// カレンダーの購読先（iCal の URL）の登録と、予定の取り出し。
// URL は暗号化して保存し、画面には返さない（docs/api.md）

// iCal の大きさの上限（何年分もの予定が入った Google カレンダーでも入る大きさ）
const ICAL_MAX_BYTES = 5 * 1024 * 1024;
const ICAL_ACCEPT = "text/calendar, text/plain;q=0.8, */*;q=0.5";
const DAY_MS = 24 * 60 * 60 * 1000;

const subscriptionColumns = {
  id: calendarSubscriptions.id,
  name: calendarSubscriptions.name,
  color: calendarSubscriptions.color,
  lastFetchedAt: calendarSubscriptions.lastFetchedAt,
  lastError: calendarSubscriptions.lastError,
};

type SubscriptionRow = {
  id: string;
  name: string;
  color: string;
  lastFetchedAt: Date | null;
  lastError: string | null;
};

function toSubscription(row: SubscriptionRow): CalendarSubscription {
  return calendarSubscriptionSchema.parse({
    ...row,
    lastFetchedAt: row.lastFetchedAt?.toISOString() ?? null,
  });
}

// まだ使っていない色を、決めた順に選ぶ（全部使っていたら、順に繰り返す）
function nextColor(used: string[]): CalendarColor {
  return (
    CALENDAR_COLOR_KEYS.find((color) => !used.includes(color)) ??
    CALENDAR_COLOR_KEYS[used.length % CALENDAR_COLOR_KEYS.length] ??
    "blue"
  );
}

// iCal の URL を登録する。一度読んでみて、iCal として読めたものだけを登録する
export async function addCalendarSubscription(
  userId: string,
  widgetId: string,
  rawUrl: string,
): Promise<Result<CalendarSubscription>> {
  const widget = await findOwnedWidget(userId, widgetId);
  if (!widget) return fail({ code: "not_found" });
  if (widget.type !== "calendar") return wrongType("calendar");

  let url: string;
  let name: string | null;
  try {
    url = parsePublicUrl(rawUrl).href;
    const res = await safeFetch(url, {
      maxBytes: ICAL_MAX_BYTES,
      accept: ICAL_ACCEPT,
    });
    name = readCalendarName(res.text);
  } catch (error) {
    if (!isFetchFailure(error)) throw error;
    return fail(toWidgetError(error));
  }
  // 暗号化は、外の URL を読んだあと（時間のかかる処理をロックの外でする）
  const encrypted = await encryptText(url);

  return db.transaction(async (tx) => {
    const locked = await lockOwnedWidget(tx, userId, widgetId);
    if (!locked) return fail({ code: "not_found" });

    const existing = await tx
      .select({ color: calendarSubscriptions.color })
      .from(calendarSubscriptions)
      .where(eq(calendarSubscriptions.widgetId, widgetId));
    if (existing.length >= CALENDAR_SUBSCRIPTIONS_MAX) {
      return fail({
        code: "too_many",
        message: `カレンダーは${CALENDAR_SUBSCRIPTIONS_MAX}個までです`,
      });
    }
    const [created] = await tx
      .insert(calendarSubscriptions)
      .values({
        widgetId,
        name: (name ?? "カレンダー").slice(0, CALENDAR_NAME_MAX),
        urlEncrypted: encrypted,
        color: nextColor(existing.map((row) => row.color)),
        lastFetchedAt: new Date(),
      })
      .returning(subscriptionColumns);
    if (!created) throw new Error("カレンダーを登録できませんでした");
    return ok(toSubscription(created));
  });
}

// 自分の購読先を、ボードの行をロックしてから読む
async function lockOwnedSubscription(
  tx: Tx,
  userId: string,
  subscriptionId: string,
) {
  const [row] = await tx
    .select({ id: calendarSubscriptions.id })
    .from(calendarSubscriptions)
    .innerJoin(widgets, eq(widgets.id, calendarSubscriptions.widgetId))
    .innerJoin(boards, eq(boards.id, widgets.boardId))
    .where(
      and(
        eq(calendarSubscriptions.id, subscriptionId),
        eq(boards.userId, userId),
      ),
    )
    .for("update", { of: boards });
  return row ?? null;
}

export async function updateCalendarSubscription(
  userId: string,
  subscriptionId: string,
  patch: z.infer<typeof updateCalendarSubscriptionSchema>,
): Promise<Result<CalendarSubscription>> {
  return db.transaction(async (tx) => {
    if (!(await lockOwnedSubscription(tx, userId, subscriptionId))) {
      return fail({ code: "not_found" });
    }
    const [saved] = await tx
      .update(calendarSubscriptions)
      .set({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.color !== undefined && { color: patch.color }),
      })
      .where(eq(calendarSubscriptions.id, subscriptionId))
      .returning(subscriptionColumns);
    if (!saved) throw new Error("カレンダーが見つかりません");
    return ok(toSubscription(saved));
  });
}

export async function deleteCalendarSubscription(
  userId: string,
  subscriptionId: string,
): Promise<Result<null>> {
  return db.transaction(async (tx) => {
    if (!(await lockOwnedSubscription(tx, userId, subscriptionId))) {
      return fail({ code: "not_found" });
    }
    await tx
      .delete(calendarSubscriptions)
      .where(eq(calendarSubscriptions.id, subscriptionId));
    return ok(null);
  });
}

// 登録したカレンダーを全部読み、from から to（端末の日付）までの予定を返す。
// 端末の時間帯がどこでも入るよう、前後に1日ずつ広げて取り出す（今日かどうかは画面で決める）
export async function getCalendarEvents(
  userId: string,
  widgetId: string,
  from: string,
  to: string,
): Promise<Result<CalendarEventsResponse>> {
  const widget = await findOwnedWidget(userId, widgetId);
  if (!widget) return fail({ code: "not_found" });
  if (widget.type !== "calendar") return wrongType("calendar");

  const rows = await db
    .select({
      ...subscriptionColumns,
      urlEncrypted: calendarSubscriptions.urlEncrypted,
    })
    .from(calendarSubscriptions)
    .where(eq(calendarSubscriptions.widgetId, widgetId))
    .orderBy(asc(calendarSubscriptions.createdAt));

  const rangeStart = new Date(Date.parse(`${from}T00:00:00Z`) - DAY_MS);
  const rangeEnd = new Date(Date.parse(`${to}T00:00:00Z`) + 2 * DAY_MS);

  // 読めなかったカレンダーは、理由を残して、ほかのカレンダーの予定だけを返す
  async function markFailed(row: SubscriptionRow, lastError: string) {
    await db
      .update(calendarSubscriptions)
      .set({ lastError })
      .where(eq(calendarSubscriptions.id, row.id));
    return { subscription: toSubscription({ ...row, lastError }), events: [] };
  }

  const results = await Promise.all(
    rows.map(async ({ urlEncrypted, ...row }) => {
      let url: string;
      try {
        url = await decryptText(urlEncrypted);
      } catch {
        // 鍵が変わったなどで読めないときは、登録し直してもらう
        return markFailed(row, "URL を読めません。登録し直してください");
      }
      try {
        const res = await safeFetch(url, {
          maxBytes: ICAL_MAX_BYTES,
          accept: ICAL_ACCEPT,
        });
        const parsed = parseCalendar(res.text, rangeStart, rangeEnd);
        const status = { lastFetchedAt: new Date(), lastError: null };
        await db
          .update(calendarSubscriptions)
          .set(status)
          .where(eq(calendarSubscriptions.id, row.id));
        const events: CalendarEvent[] = parsed.events.map((event) => ({
          id: `${row.id}:${event.uid}:${event.start}`,
          subscriptionId: row.id,
          title: event.title,
          start: event.start,
          end: event.end,
          allDay: event.allDay,
        }));
        return { subscription: toSubscription({ ...row, ...status }), events };
      } catch (error) {
        if (!isFetchFailure(error)) throw error;
        return markFailed(row, error.message);
      }
    }),
  );

  return ok({
    subscriptions: results.map((result) => result.subscription),
    events: results.flatMap((result) => result.events),
  });
}
