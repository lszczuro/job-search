import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRuntimeDeps } from "../../src/app/runtime";

describe("publishNftyNotification", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends one authenticated nfty request with click URL when enabled", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const runtime = createRuntimeDeps({
      DATABASE_PATH: ":memory:",
      NFTY_ENDPOINT: "https://nfty.sh/job-search",
      NFTY_LOGIN: "alice",
      NFTY_PASSWORD: "secret",
      NFTY_CLICK_URL: "https://job-search.local/offers"
    });

    await runtime.publishNftyNotification(3);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://nfty.sh/job-search",
      expect.objectContaining({
        method: "POST",
        body: "Znaleziono 3 nowe oferty",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("alice:secret").toString("base64")}`,
          Click: "https://job-search.local/offers"
        })
      })
    );
  });

  it("does nothing when nfty is disabled", async () => {
    const runtime = createRuntimeDeps({ DATABASE_PATH: ":memory:" });

    await runtime.publishNftyNotification(2);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
