import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS, STALE_HOURS, outboxAlert } from "./health";

describe("outboxAlert", () => {
  it("stays quiet when the queue is healthy", () => {
    expect(outboxAlert({ failed: 0, stale: 0 })).toBeNull();
  });

  it("alerts on a single permanently failed email", () => {
    // One failure already means a colleague was never told their request was accepted.
    const text = outboxAlert({ failed: 1, stale: 0 });
    expect(text).toContain("1 notification gave up");
    expect(text).toContain("SMTP password");
  });

  it("names the usual cause so the reader knows where to look", () => {
    expect(outboxAlert({ failed: 4, stale: 0 })).toContain("4 notifications gave up");
  });

  it("alerts when the queue stops draining", () => {
    const text = outboxAlert({ failed: 0, stale: DEFAULT_THRESHOLDS.stale });
    expect(text).toContain(`over ${STALE_HOURS} hours`);
    expect(text).toContain("daily retry job");
  });

  it("stays quiet below the stale threshold, since a slow evening is not a fault", () => {
    expect(outboxAlert({ failed: 0, stale: DEFAULT_THRESHOLDS.stale - 1 })).toBeNull();
  });

  it("reports both problems together rather than only the first", () => {
    const text = outboxAlert({ failed: 2, stale: 9 });
    expect(text).toContain("2 notifications gave up");
    expect(text).toContain("9 notifications have been waiting");
  });

  it("honours custom thresholds", () => {
    expect(outboxAlert({ failed: 3, stale: 0 }, { failed: 5, stale: 5 })).toBeNull();
    expect(outboxAlert({ failed: 5, stale: 0 }, { failed: 5, stale: 5 })).not.toBeNull();
  });

  it("tells the reader how to look for themselves", () => {
    expect(outboxAlert({ failed: 1, stale: 0 })).toContain("select email_status, count(*)");
  });
});
