import type { SourceAdapter } from "../lib/types";
import { gnuboardAdapter } from "./adapters/gnuboard";
import { knuWbbsAdapter } from "./adapters/knu-wbbs";
import { seeAdapter } from "./adapters/see";
import { homeKnuCmsAdapter } from "./adapters/home-knu-cms";
import { kosafAdapter } from "./adapters/kosaf";

// 플랫폼 키 → 어댑터. 새 플랫폼을 만들면 여기에 한 줄 등록한다.
export const ADAPTERS: Record<string, SourceAdapter> = {
  gnuboard: gnuboardAdapter,
  "knu-wbbs": knuWbbsAdapter,
  see: seeAdapter,
  "home-knu-cms": homeKnuCmsAdapter,
  kosaf: kosafAdapter,
};

export function getAdapter(platform: string): SourceAdapter {
  const adapter = ADAPTERS[platform];
  if (!adapter) throw new Error(`등록된 어댑터가 없습니다: "${platform}"`);
  return adapter;
}
