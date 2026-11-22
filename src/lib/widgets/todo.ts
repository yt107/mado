import * as z from "zod";

// ToDo の設定（widgets.settings）と、項目の決まり

export const TODO_TITLE_MAX = 100;
// 1つの ToDo に入れられる項目の数（増えすぎて画面も DB も重くならないように）
export const TODO_ITEMS_MAX = 50;

export const todoSettingsSchema = z.object({
  // 完了した項目も出すか
  showCompleted: z.boolean().default(true),
  // 完了した項目を下にまとめるか
  completedToBottom: z.boolean().default(false),
});

export type TodoSettings = z.infer<typeof todoSettingsSchema>;

export function readTodoSettings(settings: unknown): TodoSettings {
  const result = todoSettingsSchema.safeParse(settings);
  return result.success ? result.data : todoSettingsSchema.parse({});
}

export const todoTitleSchema = z
  .string({ error: "項目を入力してください" })
  .trim()
  .min(1, "項目を入力してください")
  .max(TODO_TITLE_MAX, `項目は${TODO_TITLE_MAX}文字までにしてください`);

export type TodoItem = {
  id: string;
  title: string;
  isDone: boolean;
  sortOrder: number;
};

// 画面に出す順番（設定に合わせて、完了したものを隠したり、下にまとめたりする）
export function visibleTodoItems(
  items: TodoItem[],
  settings: TodoSettings,
): TodoItem[] {
  const sorted = items.toSorted((a, b) => a.sortOrder - b.sortOrder);
  const shown = settings.showCompleted
    ? sorted
    : sorted.filter((item) => !item.isDone);
  if (!settings.completedToBottom) return shown;
  return [
    ...shown.filter((item) => !item.isDone),
    ...shown.filter((item) => item.isDone),
  ];
}
