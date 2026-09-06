export function haptic() {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.vibrate !== "function"
  )
    return;
  if (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  try {
    navigator.vibrate(12);
  } catch {
    /* Unsupported devices remain quiet. */
  }
}
export function claimCelebration(
  key: string,
  storage: Pick<Storage, "getItem" | "setItem">,
) {
  if (storage.getItem(key)) return false;
  storage.setItem(key, "1");
  return true;
}
