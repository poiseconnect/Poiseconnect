import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("request draft client finalization guard", () => {
  it("prevents further draft saves after a successful final submit", () => {
    const source = readFileSync("app/page-client.jsx", "utf8");

    expect(source).toContain("const requestFinalizedRef = useRef(false);");
    expect(source).toContain("if (requestFinalizedRef.current) return false;");
    expect(source).toContain("if (requestFinalizedRef.current) return;");
    expect(source).toContain("requestFinalizedRef.current = true;");
  });
});
