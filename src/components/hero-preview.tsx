"use client";

import { useState } from "react";

import type { DisplayTarget } from "@/lib/board/display-targets";
import { templateWidgets } from "@/lib/board/sample";

import { BoardPreview } from "./board/board-preview";
import { TargetPicker } from "./board/target-picker";

const SAMPLE = templateWidgets("basic", { withSample: true });

// 見本の高さの上限。どの表示先の見本も、この高さに収まる。
// 低い画面では、見出しと下のボタン（余白を合わせて約 26rem）が画面に収まるように、さらに低くする
const PREVIEW_HEIGHT = "min(56vh, calc(100dvh - 26rem))";

// ログインの画面の右側に出す、ボードの見本（ベーシックのテンプレート）
export function HeroPreview({
  showTargetPicker = false,
}: {
  showTargetPicker?: boolean;
}) {
  const [target, setTarget] = useState<DisplayTarget>("pc");
  const preview = (
    <BoardPreview widgets={SAMPLE} target={target} maxHeight={PREVIEW_HEIGHT} />
  );
  return (
    <div className="flex w-full flex-col items-center gap-8">
      {showTargetPicker ? (
        // 見本の高さは表示先で変わる（サブディスプレイはとても低い）。
        // 見本を置く場所の高さを固定して、その中で見本を上下の中央に置く。
        // こうすると、表示先を切り替えても、上の見出しと下のボタンが動かない
        <div
          className="flex w-full items-center"
          style={{ height: PREVIEW_HEIGHT }}
        >
          {preview}
        </div>
      ) : (
        preview
      )}
      {showTargetPicker && (
        <TargetPicker name="heroTarget" value={target} onChange={setTarget} />
      )}
    </div>
  );
}
