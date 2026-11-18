"use client";

import { ArrowRight, Check, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BoardPreview } from "@/components/board/board-preview";
import { TargetPicker } from "@/components/board/target-picker";
import { Logo } from "@/components/logo";
import { StepIndicator } from "@/components/step-indicator";
import { WIDGET_ICONS } from "@/components/widgets/widget-icon";
import { api } from "@/lib/api-client";
import type { DisplayTarget } from "@/lib/board/display-targets";
import { templateWidgets } from "@/lib/board/sample";
import {
  TEMPLATE_IDS,
  TEMPLATES,
  type TemplateId,
} from "@/lib/board/templates";
import { WIDGET_LABELS } from "@/lib/widgets/types";

import { TemplateThumbnail } from "./template-thumbnail";

const UNEXPECTED_ERROR =
  "うまくいきませんでした。時間をおいて、もう一度お試しください";

// テンプレートの選択画面（初回の設定）。選んだテンプレートでボードを作り、表示モードへ移る
export function TemplatePicker() {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<TemplateId>("basic");
  const [target, setTarget] = useState<DisplayTarget>("pc");
  const [error, setError] = useState<string | null>(null);
  // 送っているあいだは、ボタンを押せないようにする（2回送らないため）
  const [isPending, startTransition] = useTransition();

  const template = TEMPLATES[templateId];

  function create(id: TemplateId) {
    setError(null);
    startTransition(async () => {
      const res = await api.boards.$post({ json: { templateId: id } });
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
    create(templateId);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-6">
        <Logo />
        <StepIndicator current={3} variant="plain" className="hidden lg:flex" />
        {/* スキップしたら、白紙のボードで始める */}
        <button
          type="button"
          onClick={() => create("blank")}
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
                      <span className="block font-bold">{t.name}</span>
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
            widgets={templateWidgets(templateId)}
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
              ボードを作ったら、表示モードで開きます
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
                このテンプレートで始める
                <ArrowRight aria-hidden className="size-4" />
              </button>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
