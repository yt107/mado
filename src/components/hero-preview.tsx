"use client";

import { useState } from "react";

import type { DisplayTarget } from "@/lib/board/display-targets";
import { templateWidgets } from "@/lib/board/sample";

import { BoardPreview } from "./board/board-preview";
import { TargetPicker } from "./board/target-picker";

const SAMPLE = templateWidgets("basic", { withSample: true });

// ログインの画面の右側に出す、ボードの見本（ベーシックのテンプレート）
export function HeroPreview({
  showTargetPicker = false,
}: {
  showTargetPicker?: boolean;
}) {
  const [target, setTarget] = useState<DisplayTarget>("pc");
  return (
    <div className="flex w-full flex-col items-center gap-8">
      <BoardPreview widgets={SAMPLE} target={target} maxHeight="56vh" />
      {showTargetPicker && (
        <TargetPicker name="heroTarget" value={target} onChange={setTarget} />
      )}
    </div>
  );
}
