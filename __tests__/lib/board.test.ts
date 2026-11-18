// @vitest-environment node
import { describe, expect, test } from "vitest";

import {
  DISPLAY_TARGETS,
  GRIDS,
  pickDisplayTarget,
} from "@/lib/board/display-targets";
import { fitsGrid, overlaps } from "@/lib/board/layout";
import { boardMetrics } from "@/lib/board/metrics";
import { TEMPLATE_IDS, TEMPLATES } from "@/lib/board/templates";
import { normalizeSettings } from "@/lib/widgets/settings";

describe("pickDisplayTarget", () => {
  test.each([
    [1920, 1080, "pc"],
    [1440, 900, "pc"],
    [1194, 834, "tablet_landscape"],
    [1024, 768, "tablet_landscape"],
    [834, 1194, "tablet_portrait"],
    [1920, 480, "sub_display"],
    [393, 852, "phone_portrait"],
    [852, 393, "phone_landscape"],
  ])("%i×%i は %s", (width, height, expected) => {
    expect(pickDisplayTarget(width, height)).toBe(expected);
  });
});

describe("boardMetrics", () => {
  test("PC（1920×1080）は、画面設計の余白40px・すきま24pxに近い", () => {
    const m = boardMetrics(1920, 1080, GRIDS.pc);
    expect(m.scale).toBeCloseTo(1.28, 1);
    expect(m.padding).toBeCloseTo(40, -1);
    expect(m.gap).toBeCloseTo(24, -1);
  });

  test("サブディスプレイ（1920×480）は、倍率が s（0.8ほど）", () => {
    expect(boardMetrics(1920, 480, GRIDS.sub_display).scale).toBeCloseTo(
      0.83,
      1,
    );
  });

  test("スマホでは、倍率は0.75より小さくならず、余白は16px", () => {
    const m = boardMetrics(393, 824, GRIDS.phone_portrait);
    expect(m.scale).toBe(0.75);
    expect(m.padding).toBe(16);
  });
});

describe("テンプレート", () => {
  // どのテンプレートも、どの表示先でも、グリッドに収まり、重ならないこと
  describe.each(TEMPLATE_IDS)("%s", (templateId) => {
    const template = TEMPLATES[templateId];

    test("同じ種類のウィジェットは1つまで", () => {
      const types = template.widgets.map((widget) => widget.type);
      expect(new Set(types).size).toBe(types.length);
    });

    test("設定が種類ごとのスキーマに合う", () => {
      for (const widget of template.widgets) {
        expect(() =>
          normalizeSettings(widget.type, widget.settings),
        ).not.toThrow();
      }
    });

    test.each(DISPLAY_TARGETS)("%s で、収まって重ならない", (target) => {
      const placements = template.widgets.flatMap((widget) => {
        const placement = widget.placements[target];
        return placement ? [placement] : [];
      });
      for (const placement of placements) {
        expect(fitsGrid(placement, GRIDS[target])).toBe(true);
      }
      for (const [i, a] of placements.entries()) {
        for (const b of placements.slice(i + 1)) {
          expect(overlaps(a, b)).toBe(false);
        }
      }
    });
  });

  test("ベーシックは、PC で画面設計どおりに並ぶ", () => {
    const pc = Object.fromEntries(
      TEMPLATES.basic.widgets.map((widget) => [
        widget.type,
        widget.placements.pc,
      ]),
    );
    expect(pc).toEqual({
      clock: { page: 1, x: 0, y: 0, w: 2, h: 2 },
      weather: { page: 1, x: 2, y: 0, w: 1, h: 2 },
      calendar: { page: 1, x: 3, y: 0, w: 1, h: 3 },
      memo: { page: 1, x: 0, y: 2, w: 1, h: 1 },
      todo: { page: 1, x: 1, y: 2, w: 1, h: 1 },
      countdown: { page: 1, x: 2, y: 2, w: 1, h: 1 },
    });
  });
});

describe("fitsGrid と overlaps", () => {
  const grid = GRIDS.phone_portrait;

  test("はみ出したら収まらない", () => {
    expect(fitsGrid({ page: 1, x: 1, y: 0, w: 2, h: 1 }, grid)).toBe(false);
    expect(fitsGrid({ page: 1, x: 0, y: 3, w: 1, h: 2 }, grid)).toBe(false);
    expect(fitsGrid({ page: 3, x: 0, y: 0, w: 1, h: 1 }, grid)).toBe(false);
  });

  test("違うページなら重ならない", () => {
    const a = { page: 1, x: 0, y: 0, w: 2, h: 2 };
    expect(overlaps(a, { ...a, page: 2 })).toBe(false);
    expect(overlaps(a, { page: 1, x: 1, y: 1, w: 1, h: 1 })).toBe(true);
    expect(overlaps(a, { page: 1, x: 0, y: 2, w: 2, h: 1 })).toBe(false);
  });
});
