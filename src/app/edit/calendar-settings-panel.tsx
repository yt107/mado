"use client";

import {
  CalendarDays,
  Check,
  ChevronRight,
  Ellipsis,
  ExternalLink,
  Info,
  Link,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { useId, useState } from "react";

import { cx } from "@/lib/cx";
import {
  CALENDAR_COLOR_KEYS,
  CALENDAR_COLOR_LABELS,
  CALENDAR_COLORS,
  CALENDAR_NAME_MAX,
  CALENDAR_SUBSCRIPTIONS_MAX,
  readCalendarSettings,
  type CalendarColor,
  type CalendarSettings,
  type CalendarSubscription,
} from "@/lib/widgets/calendar";

import {
  FetchStatusText,
  isComposing,
  PanelShell,
  RefreshSelect,
  Segmented,
  Switch,
} from "./panel-parts";

type Props = {
  settings: Record<string, unknown>;
  subscriptions: CalendarSubscription[];
  sizeLabel: string;
  onSettingsChange: (settings: CalendarSettings) => void;
  // 登録できなかったときは、その理由を返す
  onAdd: (url: string) => Promise<string | null>;
  onUpdate: (
    subscriptionId: string,
    patch: { name?: string; color?: CalendarColor },
  ) => void;
  onDelete: (subscriptionId: string) => void;
  onClose: () => void;
};

// カレンダーの設定（画面設計「ウィジェット設定（カレンダー）」）
export function CalendarSettingsPanel({
  settings,
  subscriptions,
  sizeLabel,
  onSettingsChange,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}: Props) {
  const s = readCalendarSettings(settings);
  const id = useId();
  const [openId, setOpenId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = subscriptions.length >= CALENDAR_SUBSCRIPTIONS_MAX;

  async function add() {
    const value = url.trim();
    if (!value || adding) return;
    setAdding(true);
    setError(null);
    const message = await onAdd(value);
    setAdding(false);
    if (message) {
      setError(message);
    } else {
      setUrl("");
    }
  }

  return (
    <PanelShell
      icon={CalendarDays}
      iconColor="#e5534b"
      title="カレンダーの設定"
      subtitle={`${sizeLabel}・変更はすぐボードに反映`}
      onClose={onClose}
    >
      <section aria-labelledby={`${id}-list`}>
        <h3 id={`${id}-list`} className="mb-2 text-xs font-bold text-ink-2">
          購読しているカレンダー
        </h3>
        {subscriptions.length === 0 ? (
          <p className="text-xs text-ink-3">まだありません</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {subscriptions.map((subscription) => (
              <SubscriptionRow
                key={subscription.id}
                subscription={subscription}
                open={openId === subscription.id}
                onToggle={() =>
                  setOpenId(openId === subscription.id ? null : subscription.id)
                }
                onUpdate={(patch) => onUpdate(subscription.id, patch)}
                onDelete={() => onDelete(subscription.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`${id}-add`}>
        <h3 id={`${id}-add`} className="mb-2 text-xs font-bold text-ink-2">
          カレンダーを追加
        </h3>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Link
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
            />
            <input
              type="url"
              inputMode="url"
              value={url}
              disabled={full || adding}
              aria-label="iCal の URL"
              aria-describedby={`${id}-help ${id}-error`}
              placeholder={
                full
                  ? `${CALENDAR_SUBSCRIPTIONS_MAX}個まで登録できます`
                  : "iCal の URL"
              }
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isComposing(event)) {
                  event.preventDefault();
                  void add();
                }
              }}
              className="h-10 w-full rounded-[10px] border border-line bg-card pr-3 pl-9 placeholder:text-ink-3"
            />
          </div>
          <button
            type="button"
            onClick={() => void add()}
            disabled={full || adding || url.trim() === ""}
            className="flex h-10 shrink-0 items-center gap-1 rounded-[10px] border border-line bg-card px-3 font-bold hover:bg-raised disabled:opacity-50"
          >
            {adding ? (
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
            ) : (
              <Plus aria-hidden className="size-4" />
            )}
            追加
          </button>
        </div>
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs text-danger"
        >
          {error}
        </p>
        <p
          id={`${id}-help`}
          className="mt-1 flex gap-1.5 text-xs leading-relaxed text-ink-3"
        >
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Google カレンダーの「iCal 形式の非公開 URL」も使えます。URL
          は暗号化して保存し、あとから画面には出しません。
        </p>
        <GoogleCalendarGuide />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-bold text-ink-2">表示する内容</h3>
        <Switch
          label="月表示"
          checked={s.showMonth}
          onChange={(showMonth) => onSettingsChange({ ...s, showMonth })}
        />
        <Switch
          label="今日の予定"
          checked={s.showToday}
          onChange={(showToday) => onSettingsChange({ ...s, showToday })}
        />
        <Switch
          label="明日の予定"
          checked={s.showTomorrow}
          onChange={(showTomorrow) => onSettingsChange({ ...s, showTomorrow })}
        />
      </section>

      <Segmented
        legend="週の始まり"
        value={s.weekStart}
        options={[
          ["sunday", "日曜日"],
          ["monday", "月曜日"],
        ]}
        onChange={(weekStart) => onSettingsChange({ ...s, weekStart })}
      />

      <RefreshSelect
        value={s.refreshMinutes}
        onChange={(refreshMinutes) =>
          onSettingsChange({ ...s, refreshMinutes })
        }
      />

      <p className="flex gap-1.5 text-xs leading-relaxed text-ink-3">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        表示モードでは、カレンダーを押すと Google
        カレンダーを新しいタブで開きます（Google
        カレンダーを登録しているときだけ）。
      </p>
    </PanelShell>
  );
}

// Google カレンダーの iCal の URL の取り方。ふだんは閉じておき、押すと開く。
// 名前は Google のヘルプ（カレンダーをパソコン上のプログラムと同期する）に合わせる
const GOOGLE_CALENDAR_HELP_URL =
  "https://support.google.com/calendar/answer/37648?hl=ja";

function GoogleCalendarGuide() {
  return (
    <details className="group mt-2 rounded-lg border border-line bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
        />
        Google カレンダーの URL の取り方
      </summary>
      <div className="flex flex-col gap-2.5 border-t border-line px-3 py-2.5 text-xs leading-relaxed text-ink-2">
        <ol className="flex list-decimal flex-col gap-1 pl-4">
          <li>
            パソコンで Google
            カレンダーを開き、右上の設定アイコンから「設定」を開く
          </li>
          <li>左の「マイカレンダーの設定」で、カレンダーの名前を押す</li>
          <li>
            「カレンダーの統合」にある「iCal 形式の非公開 URL」をコピーする
          </li>
          <li>上の欄に貼り付けて「追加」を押す</li>
        </ol>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-ink-3">
          <li>
            この URL
            を知っている人は、予定を見られます。ほかの人には教えないでください
          </li>
          <li>
            知られてしまったときは、同じ画面の「リセット」で URL
            を作り直せます。そのあと、新しい URL を登録し直してください
          </li>
          <li>
            仕事や学校のアカウントで見つからないときは、管理者が共有の設定を変えている可能性があります
          </li>
        </ul>
        <a
          href={GOOGLE_CALENDAR_HELP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 self-start text-ink-2 underline underline-offset-2 hover:text-ink"
        >
          Google のヘルプ
          <ExternalLink aria-hidden className="size-3" />
          <span className="sr-only">（新しいタブで開く）</span>
        </a>
      </div>
    </details>
  );
}

function SubscriptionRow({
  subscription,
  open,
  onToggle,
  onUpdate,
  onDelete,
}: {
  subscription: CalendarSubscription;
  open: boolean;
  onToggle: () => void;
  onUpdate: (patch: { name?: string; color?: CalendarColor }) => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={cx(
        "rounded-lg border bg-card",
        subscription.lastError ? "border-danger/60" : "border-line",
      )}
    >
      <div className="flex items-center gap-2.5 py-2 pr-1 pl-3">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: CALENDAR_COLORS[subscription.color] }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{subscription.name}</p>
          <p className="truncate text-[0.6875rem] text-ink-3">
            <FetchStatusText
              lastFetchedAt={subscription.lastFetchedAt}
              lastError={subscription.lastError}
            />
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`「${subscription.name}」の名前・色・削除`}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-raised hover:text-ink"
        >
          <Ellipsis aria-hidden className="size-4" />
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
          <input
            type="text"
            defaultValue={subscription.name}
            maxLength={CALENDAR_NAME_MAX}
            aria-label="カレンダーの名前"
            // 名前は、入力欄から離れたときか Enter で保存する
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (name && name !== subscription.name) {
                onUpdate({ name });
              } else {
                event.target.value = subscription.name;
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isComposing(event)) {
                event.currentTarget.blur();
              }
            }}
            className="h-9 rounded-lg border border-line bg-surface px-2.5"
          />
          <fieldset>
            <legend className="sr-only">色</legend>
            <div className="flex flex-wrap gap-1.5">
              {CALENDAR_COLOR_KEYS.map((color) => (
                <label key={color} className="cursor-pointer">
                  <input
                    type="radio"
                    name={`color-${subscription.id}`}
                    value={color}
                    checked={subscription.color === color}
                    onChange={() => onUpdate({ color })}
                    aria-label={CALENDAR_COLOR_LABELS[color]}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className="grid size-6 place-items-center rounded-full text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                    style={{ backgroundColor: CALENDAR_COLORS[color] }}
                  >
                    {subscription.color === color && (
                      <Check className="size-3.5" strokeWidth={3} />
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 self-start rounded-lg px-1 py-1 text-xs text-danger hover:underline"
          >
            <Trash2 aria-hidden className="size-3.5" />
            登録をやめる
          </button>
        </div>
      )}
    </li>
  );
}
