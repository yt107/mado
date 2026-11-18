// @vitest-environment node
import { describe, expect, test } from "vitest";

import { GRIDS } from "@/lib/board/display-targets";
import {
  cellAt,
  describePlacement,
  dropPlacement,
  moveBy,
  othersOn,
  placementOn,
} from "@/lib/board/edit";
import {
  canPlace,
  clampSize,
  findFreeSpot,
  sizesThatFit,
} from "@/lib/board/layout";
import { templateWidgets } from "@/lib/board/sample";

const pc = GRIDS.pc;

describe("cellAt", () => {
  // 4×3 のグリッド。余白40・すきま24で、マスは 442×318（PC の画面設計と同じ）
  const rect = { left: 0, top: 0, width: 1920, height: 1080 };
  const metrics = { padding: 40, gap: 24 };

  test.each([
    [
      { x: 100, y: 100 },
      { x: 0, y: 0 },
    ],
    [
      { x: 1900, y: 1060 },
      { x: 3, y: 2 },
    ],
    // マスとマスのすきまの真ん中より左は左のマス、右は右のマス
    [
      { x: 40 + 442 + 10, y: 100 },
      { x: 0, y: 0 },
    ],
    [
      { x: 40 + 442 + 14, y: 100 },
      { x: 1, y: 0 },
    ],
  ])("%o は %o", (point, expected) => {
    expect(cellAt(point, rect, pc, metrics, 1)).toEqual(expected);
  });

  test("縮めて見せているときも、同じマスになる", () => {
    const half = { left: 100, top: 50, width: 960, height: 540 };
    expect(
      cellAt({ x: 100 + 950, y: 50 + 530 }, half, pc, metrics, 0.5),
    ).toEqual({ x: 3, y: 2 });
  });

  test("グリッドの外なら null", () => {
    expect(cellAt({ x: 2100, y: 100 }, rect, pc, metrics, 1)).toBeNull();
    expect(cellAt({ x: -100, y: 100 }, rect, pc, metrics, 1)).toBeNull();
  });
});

describe("配置の計算", () => {
  // スタンバイの PC：時計(0,0,3,3)・天気(3,0,1,1)・カレンダー(3,1,1,2) で全部埋まっている
  const standby = templateWidgets("standby");
  const clock = standby.find((w) => w.type === "clock")!;

  test("placementOn と othersOn", () => {
    expect(placementOn(clock, "pc")).toEqual({
      page: 1,
      x: 0,
      y: 0,
      w: 3,
      h: 3,
    });
    expect(othersOn(standby, "pc", clock.id)).toHaveLength(2);
  });

  test("空きがなければ findFreeSpot は null。外せば見つかる", () => {
    const others = othersOn(standby, "pc");
    expect(findFreeSpot({ w: 1, h: 1 }, others, pc)).toBeNull();
    const withoutWeather = othersOn(
      standby.filter((w) => w.type !== "weather"),
      "pc",
    );
    expect(findFreeSpot({ w: 1, h: 1 }, withoutWeather, pc)).toEqual({
      page: 1,
      x: 3,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  test("スマホ縦は、1ページ目が埋まっていれば2ページ目を探す", () => {
    const grid = GRIDS.phone_portrait;
    const full = [{ page: 1, x: 0, y: 0, w: 2, h: 4 }];
    expect(findFreeSpot({ w: 2, h: 2 }, full, grid)).toEqual({
      page: 2,
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });
  });

  test("sizesThatFit は、重ならずに収まる大きさだけ", () => {
    const others = [{ page: 1, x: 2, y: 0, w: 1, h: 1 }];
    const sizes = sizesThatFit({ page: 1, x: 0, y: 0 }, others, pc);
    expect(sizes).toContainEqual({ w: 2, h: 3 });
    expect(sizes).not.toContainEqual({ w: 3, h: 1 });
  });

  test("clampSize は、グリッドに入る大きさまで小さくする", () => {
    expect(clampSize({ w: 1, h: 3 }, GRIDS.sub_display)).toEqual({
      w: 1,
      h: 2,
    });
  });

  test("moveBy は、動かせるときだけ新しい配置を返す", () => {
    const a = { page: 1, x: 0, y: 0, w: 1, h: 1 };
    const others = [{ page: 1, x: 1, y: 0, w: 1, h: 1 }];
    expect(moveBy(a, 1, 0, others, pc)).toBeNull();
    expect(moveBy(a, -1, 0, others, pc)).toBeNull();
    expect(moveBy(a, 0, 1, others, pc)).toEqual({ ...a, y: 1 });
    expect(canPlace({ ...a, y: 1 }, others, pc)).toBe(true);
  });

  test("dropPlacement：決まった大きさで置き、はみ出すなら左上へずらす", () => {
    // 時計は 2×2。右下のマスに落としても、収まるように左上へずらす
    expect(dropPlacement("clock", { page: 1, x: 3, y: 2 }, [], "pc")).toEqual({
      placement: { page: 1, x: 2, y: 1, w: 2, h: 2 },
      valid: true,
    });
  });

  test("dropPlacement：入らなければ 1×1 を試し、それも無理なら置けない", () => {
    const others = [{ page: 1, x: 1, y: 0, w: 3, h: 3 }];
    expect(
      dropPlacement("clock", { page: 1, x: 0, y: 0 }, others, "pc"),
    ).toEqual({ placement: { page: 1, x: 0, y: 0, w: 1, h: 1 }, valid: true });
    const full = [{ page: 1, x: 0, y: 0, w: 4, h: 3 }];
    expect(
      dropPlacement("todo", { page: 1, x: 0, y: 0 }, full, "pc").valid,
    ).toBe(false);
  });

  test("dropPlacement：行が2つの表示先では、カレンダー（1×3）を 1×2 にする", () => {
    expect(
      dropPlacement("calendar", { page: 1, x: 0, y: 0 }, [], "sub_display")
        .placement,
    ).toEqual({ page: 1, x: 0, y: 0, w: 1, h: 2 });
  });

  test("describePlacement", () => {
    expect(describePlacement({ page: 1, x: 1, y: 0, w: 2, h: 1 }, pc)).toBe(
      "2列目・1行目、2×1",
    );
    expect(
      describePlacement(
        { page: 2, x: 0, y: 0, w: 1, h: 1 },
        GRIDS.phone_portrait,
      ),
    ).toBe("2ページ目の1列目・1行目、1×1");
  });
});
