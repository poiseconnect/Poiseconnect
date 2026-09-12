export function shouldCloseModalFromBackdrop(event, isPointerEvent = false) {
  if (!event || typeof event !== "object") return false;

  const target = event.target;
  const currentTarget = event.currentTarget;

  if (!target || !currentTarget) return false;
  if (target !== currentTarget) return false;

  if (isPointerEvent) {
    if (typeof event.button !== "number") return false;
    if (event.button !== 0) return false;
  }

  return true;
}

export function shouldCloseModalFromBackdropClick(event, options = {}) {
  const {
    startedOnBackdrop = false,
    startedInsideContent = false,
    isPointerEvent = false,
  } = options;

  if (!shouldCloseModalFromBackdrop(event, isPointerEvent)) return false;
  if (startedInsideContent) return false;
  if (startedOnBackdrop !== true) return false;

  return true;
}
