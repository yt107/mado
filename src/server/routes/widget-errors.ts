import type { Context } from "hono";

import type { WidgetError } from "../services/widgets";

// 編集の処理がうまくいかなかったときの返し方（docs/api.md のエラーの形）
export function widgetErrorResponse(
  c: Context,
  error: WidgetError,
  notFoundMessage = "ウィジェットが見つかりません",
) {
  switch (error.code) {
    case "not_found":
      return c.json(
        { error: { code: "not_found", message: notFoundMessage } },
        404,
      );
    case "out_of_grid":
      return c.json(
        {
          error: {
            code: "validation_error",
            message: "グリッドからはみ出しています",
          },
        },
        400,
      );
    case "invalid_settings":
      return c.json(
        { error: { code: "validation_error", message: error.message } },
        400,
      );
    case "overlap":
      return c.json(
        {
          error: {
            code: "conflict",
            message: "ほかのウィジェットと重なっています",
          },
        },
        409,
      );
    case "already_placed":
      return c.json(
        {
          error: {
            code: "conflict",
            message: "この表示先には、もう置いてあります",
          },
        },
        409,
      );
  }
}
