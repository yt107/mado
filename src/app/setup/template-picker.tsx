"use client";

import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BoardPreview } from "@/components/board/board-preview";
import { LocationSearch } from "@/components/location-search";
import { TargetPicker } from "@/components/board/target-picker";
import { Logo } from "@/components/logo";
import { StepIndicator } from "@/components/step-indicator";
import { WIDGET_ICONS } from "@/components/widgets/widget-icon";
import { api } from "@/lib/api-client";
import type { DisplayTarget } from "@/lib/board/display-targets";
import { templateWidgets } from "@/lib/board/sample";
import {
  RECOMMENDED_TEMPLATE_ID,
  TEMPLATE_IDS,
  TEMPLATES,
  type TemplateId,
} from "@/lib/board/templates";
import { WIDGET_LABELS } from "@/lib/widgets/types";
import {
  DEFAULT_WEATHER_LOCATION,
  type WeatherLocation,
} from "@/lib/widgets/weather";

import { TemplateThumbnail } from "./template-thumbnail";

const UNEXPECTED_ERROR =
  "うまくいきませんでした。時間をおいて、もう一度お試しください";

// 初回の設定：テンプレートの選択 → 天気の地域（天気が入っているテンプレートだけ）。
// 選んだテンプレートでボードを作り、表示モードへ移る
export function TemplatePicker() {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<TemplateId>(
    RECOMMENDED_TEMPLATE_ID,
  );
  const [target, setTarget] = useState<DisplayTarget>("pc");
  const [step, setStep] = useState<"template" | "region">("template");
  // 地域は、最初から東京を選んでおく（変えなければ東京で作る）
  const [location, setLocation] = useState<WeatherLocation | null>(
    DEFAULT_WEATHER_LOCATION,
  );
  const [error, setError] = useState<string | null>(null);
  // 送っているあいだは、ボタンを押せないようにする（2回送らないため）
  const [isPending, startTransition] = useTransition();

  const template = TEMPLATES[templateId];
  const hasWeather = template.widgets.some((w) => w.type === "weather");

  function create(id: TemplateId, chosen: WeatherLocation | null = null) {
    setError(null);
    startTransition(async () => {
      const res = await api.boards.$post({
        json: chosen
          ? { templateId: id, location: chosen }
          : { templateId: id },
      });
      // 401 と 403 はミドルウェアが返すので、API の型には出てこない。数として比べる
      const status = res.status as number;
      if (status === 401) {
        router.push("/login");
        return;
      }
      if (status === 403) {
        router.push("/welcome");
        return;
      }
      // 作れた（または、もうボードがあった）なら、表示モードへ
      if (res.ok || res.status === 409) {
        router.push("/");
        return;
      }
      setError(UNEXPECTED_ERROR);
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === "template" && hasWeather) {
      setStep("region");
      return;
    }
    create(templateId, step === "region" ? location : null);
  }

  // プレビューの天気には、選んだ地域の名前を出す
  const previewWidgets = templateWidgets(templateId, { withSample: true }).map(
    (widget) =>
      widget.type === "weather" && location
        ? { ...widget, settings: { ...widget.settings, location } }
        : widget,
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-6">
        <Logo />
        <StepIndicator
          current={step === "template" ? 3 : 4}
          variant="plain"
          className="hidden lg:flex"
        />
        {/* テンプレートの選択でスキップしたら、白紙のボードで始める。
            地域でスキップしたら、地域の初期値（東京）で作る */}
        <button
          type="button"
          onClick={() =>
            step === "template" ? create("blank") : create(templateId)
          }
          disabled={isPending}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-ink-2 hover:text-ink disabled:opacity-60"
        >
          スキップ
          <ArrowRight aria-hidden className="size-4" />
        </button>
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid flex-1 lg:grid-cols-[460px_minmax(0,1fr)]"
      >
        {step === "region" ? (
          <section className="bg-surface px-6 py-10 lg:border-r lg:border-line lg:px-8">
            <h1 className="text-3xl font-bold">天気の地域</h1>
            <p className="mt-4 text-sm leading-relaxed text-ink-2">
              天気のウィジェットに使う地域を選びます。あとから天気の設定で変えられます。
            </p>
            <div className="mt-8">
              <LocationSearch
                label="天気の地域"
                value={location}
                onChange={setLocation}
              />
            </div>
            <button
              type="button"
              onClick={() => setStep("template")}
              className="mt-8 flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
            >
              <ArrowLeft aria-hidden className="size-4" />
              テンプレートを選び直す
            </button>
          </section>
        ) : (
          <section className="bg-surface px-6 py-10 lg:border-r lg:border-line lg:px-8">
            <h1 className="text-3xl font-bold">テンプレートを選択</h1>
            <p className="mt-4 text-sm leading-relaxed text-ink-2">
              ウィジェットが配置された状態から始められます。あとから自由に追加・移動・取り外しできます。
            </p>

            <fieldset className="mt-8">
              <legend className="sr-only">テンプレート</legend>
              <div className="flex flex-col gap-3">
                {TEMPLATE_IDS.map((id) => {
                  const t = TEMPLATES[id];
                  return (
                    <label
                      key={id}
                      className="group relative flex cursor-pointer items-center gap-4 rounded-xl border border-transparent p-3 hover:bg-card has-checked:border-accent has-checked:bg-card has-focus-visible:outline-2 has-focus-visible:outline-accent"
                    >
                      <input
                        type="radio"
                        name="templateId"
                        value={id}
                        checked={templateId === id}
                        onChange={() => setTemplateId(id)}
                        className="sr-only"
                      />
                      <TemplateThumbnail template={t} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-bold">{t.name}</span>
                          {id === RECOMMENDED_TEMPLATE_ID && (
                            <span className="rounded-md border border-accent/60 px-1.5 py-0.5 text-[0.6875rem] whitespace-nowrap text-accent-ink">
                              おすすめ
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-ink-2">
                          {t.description}
                        </span>
                        <span className="mt-1 block text-[0.6875rem] text-ink-3">
                          {t.widgets.length > 0
                            ? `${t.widgets.length} ウィジェット`
                            : "ウィジェットなし"}
                        </span>
                      </span>
                      {/* 選んでいるものに、チェックの印を付ける */}
                      <span
                        aria-hidden
                        className="absolute top-3 right-3 hidden size-5 place-items-center rounded-full bg-accent text-on-accent group-has-checked:grid"
                      >
                        <Check className="size-3.5" />
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>
        )}

        <section
          aria-labelledby="preview-title"
          className="flex min-w-0 flex-col gap-6 px-6 py-10 lg:px-10"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-accent-ink">プレビュー</p>
              <h2 id="preview-title" className="mt-1 text-2xl font-bold">
                {template.name}
              </h2>
            </div>
            <TargetPicker
              name="previewTarget"
              value={target}
              onChange={setTarget}
            />
          </div>

          <BoardPreview
            widgets={previewWidgets}
            target={target}
            maxHeight="52vh"
          />

          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
            <span className="mr-1 text-ink-3">含まれるウィジェット</span>
            {template.widgets.length === 0 && <span>なし</span>}
            {template.widgets.map((widget) => {
              const Icon = WIDGET_ICONS[widget.type];
              const pc = widget.placements.pc;
              return (
                <span
                  key={widget.type}
                  className="flex items-center gap-1.5 rounded-md bg-raised px-2 py-1"
                >
                  <Icon aria-hidden className="size-3.5" />
                  {WIDGET_LABELS[widget.type]}
                  {pc && ` ${pc.w}×${pc.h}`}
                </span>
              );
            })}
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
            <p className="flex items-center gap-2 text-xs text-ink-3">
              <Info aria-hidden className="size-3.5 shrink-0" />
              {step === "region"
                ? "地域は、あとから天気の設定で変えられます"
                : "ボードを作ったら、表示モードで開きます"}
            </p>
            <div className="flex flex-col items-end gap-2">
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
              <button
                type="submit"
                disabled={isPending}
                className="flex h-12 items-center gap-2 rounded-[10px] bg-accent px-6 font-bold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {step === "region"
                  ? "ダッシュボードを作成"
                  : hasWeather
                    ? "次へ（天気の地域）"
                    : "このテンプレートで始める"}
                <ArrowRight aria-hidden className="size-4" />
              </button>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
