import { SafeFetchError } from "../net/safe-fetch";
import { FeedParseError } from "../sources/feed";
import { CalendarParseError } from "../sources/ical";
import type { WidgetError } from "./widgets";

// 外の URL（iCal、RSS）を読んだときの失敗。どれも、利用者に見せてよい短い文を持つ
export type FetchFailure = SafeFetchError | CalendarParseError | FeedParseError;

export function isFetchFailure(error: unknown): error is FetchFailure {
  return (
    error instanceof SafeFetchError ||
    error instanceof CalendarParseError ||
    error instanceof FeedParseError
  );
}

// 登録のときの失敗を、API のエラーにする。URL の形が正しくない・読めない場所なら入力の誤り（400）、
// 相手から読めなかったなら 422
export function toWidgetError(error: FetchFailure): WidgetError {
  if (
    error instanceof SafeFetchError &&
    (error.reason === "invalid_url" || error.reason === "blocked")
  ) {
    return { code: "invalid_input", message: error.message };
  }
  return { code: "fetch_failed", message: error.message };
}
