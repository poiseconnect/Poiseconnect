import { describe, expect, it } from "vitest";
import {
  shouldCloseModalFromBackdrop,
  shouldCloseModalFromBackdropClick,
} from "../../app/lib/modalEventGuard.js";

describe("modal backdrop close guard", () => {
  it("closes only on actual backdrop interaction", () => {
    const backDrop = { id: "backdrop" };
    const modalContent = { id: "content" };

    expect(
      shouldCloseModalFromBackdrop(
        { target: backDrop, currentTarget: backDrop },
        false
      )
    ).toBe(true);

    expect(
      shouldCloseModalFromBackdrop(
        { target: modalContent, currentTarget: backDrop },
        false
      )
    ).toBe(false);

    expect(
      shouldCloseModalFromBackdrop(
        { target: backDrop, currentTarget: backDrop },
        true
      )
    ).toBe(false);

    expect(
      shouldCloseModalFromBackdrop(
        { target: backDrop, currentTarget: backDrop, button: 0 },
        true
      )
    ).toBe(true);

    expect(
      shouldCloseModalFromBackdrop(
        { target: backDrop, currentTarget: backDrop, button: 2 },
        true
      )
    ).toBe(false);
  });

  it("closes only when interaction both starts and ends on backdrop", () => {
    const backDrop = { id: "backdrop" };

    expect(
      shouldCloseModalFromBackdropClick(
        { target: backDrop, currentTarget: backDrop, button: 0 },
        {
          startedOnBackdrop: true,
          startedInsideContent: false,
          isPointerEvent: true,
        }
      )
    ).toBe(true);
  });

  it("does not close when interaction starts inside modal content and ends on backdrop", () => {
    const backDrop = { id: "backdrop" };

    expect(
      shouldCloseModalFromBackdropClick(
        { target: backDrop, currentTarget: backDrop, button: 0 },
        {
          startedOnBackdrop: false,
          startedInsideContent: true,
          isPointerEvent: true,
        }
      )
    ).toBe(false);
  });

  it("does not close for normal clicks inside content", () => {
    const backDrop = { id: "backdrop" };
    const modalContent = { id: "content" };

    expect(
      shouldCloseModalFromBackdropClick(
        { target: modalContent, currentTarget: backDrop, button: 0 },
        {
          startedOnBackdrop: false,
          startedInsideContent: true,
          isPointerEvent: true,
        }
      )
    ).toBe(false);
  });
});
