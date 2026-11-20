"use client";

import { createContext, useContext, type ReactNode } from "react";

// 見本のボード（ログインの画面、テンプレートの選択）かどうか。
// 見本では、天気・予定・ニュースを外から読まず、決まった見本の中身を出す
const SampleModeContext = createContext(false);

export function SampleMode({ children }: { children: ReactNode }) {
  return (
    <SampleModeContext.Provider value={true}>
      {children}
    </SampleModeContext.Provider>
  );
}

export function useSampleMode() {
  return useContext(SampleModeContext);
}
