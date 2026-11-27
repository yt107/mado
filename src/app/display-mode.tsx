"use client";

import { Maximize, Minimize, Monitor, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { BoardView, PAGER_HEIGHT } from "@/components/board/board-view";
import {
  DISPLAY_TARGET_LABELS,
  DISPLAY_TARGETS,
  GRIDS,
  pickDisplayTarget,
  type DisplayTarget,
} from "@/lib/board/display-targets";
import type { BoardDetail } from "@/lib/board/schema";
import { cx } from "@/lib/cx";
import { useSessionKeepAlive } from "@/lib/hooks/use-session-keep-alive";

// 操作バーを隠すまでの時間と、ボードを読み直す間隔
const HIDE_AFTER_MS = 3000;
const REFRESH_EVERY_MS = 5 * 60 * 1000;

// 端末で固定した表示先は、この端末のブラウザに保存する（er.md「DBに持たないもの」）
const STORAGE_KEY = "mado:display-target";
const STORAGE_EVENT = "mado:display-target-change";

function isDisplayTarget(value: unknown): value is DisplayTarget {
  return DISPLAY_TARGETS.includes(value as DisplayTarget);
}

// 保存した表示先。保存できない環境（プライベートブラウズなど）でも動くようにする
function readFixedTarget(): DisplayTarget | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isDisplayTarget(value) ? value : null;
  } catch {
    return null;
  }
}

function writeFixedTarget(target: DisplayTarget | null) {
  try {
    if (target) {
      localStorage.setItem(STORAGE_KEY, target);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // 保存できなくても、この画面のあいだは選んだ表示先で表示する
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribeFixedTarget(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

// 画面の大きさ（表示先を自動で選ぶため）
function subscribeResize(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

function subscribeFullscreen(callback: () => void) {
  document.addEventListener("fullscreenchange", callback);
  return () => document.removeEventListener("fullscreenchange", callback);
}

// 表示モード。編集用のボタンを隠し、ウィジェットだけを画面いっぱいに出す
export function DisplayMode({ board }: { board: BoardDetail }) {
  const router = useRouter();
  // 開いているあいだは、ログインの期限を延ばす（表示用の端末がログアウトしないように）
  useSessionKeepAlive();

  const fixedTarget = useSyncExternalStore(
    subscribeFixedTarget,
    readFixedTarget,
    () => null,
  );
  const autoTarget = useSyncExternalStore(
    subscribeResize,
    () => pickDisplayTarget(window.innerWidth, window.innerHeight),
    () => "pc" as const,
  );
  const target = fixedTarget ?? autoTarget;

  const fullscreenEnabled = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenEnabled,
    () => false,
  );
  const isFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement !== null,
    () => false,
  );

  // 操作バーは、画面をタップするかマウスを動かすと出し、しばらくすると隠す
  const [barVisible, setBarVisible] = useState(true);
  const barRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(function hide() {
      // 操作バーの中にフォーカスがあるあいだは隠さない
      if (barRef.current?.contains(document.activeElement)) {
        hideTimer.current = setTimeout(hide, HIDE_AFTER_MS);
        return;
      }
      setBarVisible(false);
    }, HIDE_AFTER_MS);
  }, []);

  const showBar = useCallback(() => {
    setBarVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    scheduleHide();
    // タップでは、指を離したあとに出す。押した瞬間に出すと、バーが指の下に来て、
    // 押そうとしたボタン（ページ送りの点など）ではなくバーに当たってしまうため
    window.addEventListener("pointermove", showBar);
    window.addEventListener("pointerup", showBar);
    window.addEventListener("keydown", showBar);
    return () => {
      clearTimeout(hideTimer.current);
      window.removeEventListener("pointermove", showBar);
      window.removeEventListener("pointerup", showBar);
      window.removeEventListener("keydown", showBar);
    };
  }, [scheduleHide, showBar]);

  // ほかの端末で編集した内容が出るように、ときどきボードを読み直す。
  // タブが見えるようになったときにも読み直す
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      // 断られたとき（ブラウザの設定など）は、何もしない
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  return (
    <main
      className={cx(
        "relative h-dvh w-full overflow-hidden bg-canvas",
        // 操作バーを隠しているあいだは、マウスのカーソルも隠す
        !barVisible && "cursor-none",
      )}
    >
      <h1 className="sr-only">{board.name}</h1>
      <BoardView widgets={board.widgets} target={target} interactive />

      <div
        ref={barRef}
        role="group"
        aria-label="表示モードの操作"
        onFocus={showBar}
        className={cx(
          "absolute left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-1 rounded-xl border border-line bg-card/95 p-1.5 text-sm shadow-lg backdrop-blur motion-safe:transition-[opacity,translate] motion-safe:duration-300",
          !barVisible && "pointer-events-none translate-y-3 opacity-0",
        )}
        // ページ送りの点があるときは、点に重ならないように、その上に出す
        style={{
          bottom: GRIDS[target].pages > 1 ? PAGER_HEIGHT + 12 : 24,
        }}
      >
        <Link
          href="/edit"
          className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 font-bold text-on-accent hover:opacity-90"
        >
          <Pencil aria-hidden className="size-4" />
          {/* 狭い画面では、文字は読み上げだけにして、アイコンで見せる */}
          <span className="max-sm:sr-only">編集に戻る</span>
        </Link>

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        {/* ボードの名前は出さない（ボタンの並びの中で、押せるものと見分けにくいため。
            MVP ではボードが1つだけなので、名前で見分ける必要もない） */}
        <label className="flex min-h-9 min-w-0 items-center gap-1.5 rounded-lg px-2 text-ink-2 hover:bg-raised has-focus-visible:outline-2 has-focus-visible:outline-accent">
          <Monitor aria-hidden className="size-4 shrink-0" />
          <span className="max-sm:sr-only">表示先：</span>
          <select
            aria-label="表示先"
            value={fixedTarget ?? "auto"}
            onChange={(event) => {
              const value = event.target.value;
              writeFixedTarget(isDisplayTarget(value) ? value : null);
            }}
            className="min-w-0 cursor-pointer truncate bg-transparent text-ink outline-none"
          >
            <option value="auto">
              自動（{DISPLAY_TARGET_LABELS[autoTarget]}）
            </option>
            {DISPLAY_TARGETS.map((t) => (
              <option key={t} value={t}>
                {DISPLAY_TARGET_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        {fullscreenEnabled && (
          <>
            <span aria-hidden className="mx-1 h-5 w-px bg-line" />
            <button
              type="button"
              aria-label="全画面表示"
              aria-pressed={isFullscreen}
              title={isFullscreen ? "全画面表示をやめる" : "全画面表示にする"}
              onClick={toggleFullscreen}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-raised hover:text-ink"
            >
              {isFullscreen ? (
                <Minimize aria-hidden className="size-4" />
              ) : (
                <Maximize aria-hidden className="size-4" />
              )}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
