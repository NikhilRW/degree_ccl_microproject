import { expect, it } from "vitest";
import { currency } from "./format";

it("preserves paise in edited catalogue prices without adding decimals to whole rupees", () => {
  expect(currency(999.99)).toBe("₹999.99");
  expect(currency(1000)).toBe("₹1,000");
});
