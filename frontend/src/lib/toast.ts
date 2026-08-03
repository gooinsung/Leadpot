/**
 * 토스트 알림 (U5).
 *
 * 지금까지 저장·삭제가 성공해도 화면에 아무 반응이 없어서, 눌린 건지 저장된 건지
 * 알 수 없었다(실패만 `auth-error` 로 표시). 이 모듈이 성공·실패 피드백을 담당한다.
 *
 * 컨텍스트가 아니라 **모듈 수준 저장소**다 — 콜백·유틸 어디서든 `toast.success(...)`
 * 로 부를 수 있고, 라우트가 바뀌어도 살아남는다(저장 후 목록으로 이동하는 화면 때문).
 */

export type ToastKind = "success" | "error" | "info";
export type ToastItem = { id: number; kind: ToastKind; message: string };

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<(items: ToastItem[]) => void>();

function emit() {
  for (const l of listeners) l(items);
}

export function subscribeToasts(fn: (items: ToastItem[]) => void): () => void {
  listeners.add(fn);
  fn(items);
  return () => {
    listeners.delete(fn);
  };
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastKind, message: string, ms: number): number {
  const id = ++seq;
  items = [...items, { id, kind, message }];
  emit();
  window.setTimeout(() => dismissToast(id), ms);
  return id;
}

export const toast = {
  success: (message: string) => push("success", message, 3000),
  info: (message: string) => push("info", message, 4000),
  /** 실패는 읽을 시간이 더 필요하다. */
  error: (message: string) => push("error", message, 6000),
};
