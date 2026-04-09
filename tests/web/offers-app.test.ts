// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

const offers = [
  {
    id: 1,
    stanowisko: "AI Engineer",
    dataDodania: "2026-04-09",
    firma: "Acme",
    priorytet: "🔥 Teraz",
    url: "https://example.com/1",
    lokalizacja: "Remote",
    trybPracy: "Remote",
    kontrakt: "B2B",
    widełkiOd: 20000,
    widełkiDo: 28000,
    statusOgloszenia: "🟢 Aktywne",
    statusAplikacji: "📋 Zapisana",
    notatki: "Python,AI",
    ostatniaWeryfikacja: "2026-04-09T08:00:00.000Z"
  },
  {
    id: 2,
    stanowisko: "Platform Engineer",
    dataDodania: "2026-04-08",
    firma: "Beta",
    priorytet: "👀 Obserwuj",
    url: "https://example.com/2",
    lokalizacja: "Katowice",
    trybPracy: "Hybrid",
    kontrakt: "UoP",
    widełkiOd: 15000,
    widełkiDo: 21000,
    statusOgloszenia: "🟢 Aktywne",
    statusAplikacji: "📋 Zapisana",
    notatki: "Go",
    ostatniaWeryfikacja: null
  }
];

const offersWithThreeStatuses = [
  ...offers,
  {
    id: 3,
    stanowisko: "Closed Role",
    dataDodania: "2026-04-07",
    firma: "Gamma",
    priorytet: "⏳ Później",
    url: "https://example.com/3",
    lokalizacja: "Warszawa",
    trybPracy: "Onsite",
    kontrakt: "B2B",
    widełkiOd: 12000,
    widełkiDo: 18000,
    statusOgloszenia: "🔴 Zamknięte",
    statusAplikacji: "❌ Odrzucona",
    notatki: "Legacy",
    ostatniaWeryfikacja: "2026-04-07T08:00:00.000Z"
  }
];

describe("offers app", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("filters rows by location from the column filter controls", async () => {
    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
    `;

    await import("../../src/web/client/offers-app");

    fireEvent.change(await screen.findByLabelText("Filtr Lokalizacja"), {
      target: { value: "Remote" }
    });

    expect(screen.getByText("1 / 2 ofert")).toBeTruthy();
    expect(screen.getByText("AI Engineer")).toBeTruthy();
    expect(screen.queryByText("Platform Engineer")).toBeNull();
  });

  it("filters rows by exact date added", async () => {
    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
    `;

    await import("../../src/web/client/offers-app");

    fireEvent.change(await screen.findByLabelText("Filtr Data dodania"), {
      target: { value: "2026-04-09" }
    });

    expect(screen.getByText("1 / 2 ofert")).toBeTruthy();
    expect(screen.getByText("AI Engineer")).toBeTruthy();
    expect(screen.queryByText("Platform Engineer")).toBeNull();
  });

  it("filters rows by multiple selected status values", async () => {
    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">${JSON.stringify(offersWithThreeStatuses)}</script>
    `;

    await import("../../src/web/client/offers-app");

    fireEvent.click(await screen.findByRole("button", { name: "Filtr Status ogłoszenia" }));
    fireEvent.click(await screen.findByLabelText("🟢 Aktywne"));
    fireEvent.click(await screen.findByLabelText("⏸️ Wstrzymane"));

    expect(screen.getByText("2 / 3 ofert")).toBeTruthy();
    expect(screen.queryByText("Closed Role")).toBeNull();
  });

  it("filters note labels from the notes column and clears active filters", async () => {
    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
    `;

    await import("../../src/web/client/offers-app");

    fireEvent.click(await screen.findByRole("button", { name: "Filtr Notatki" }));
    fireEvent.click(await screen.findByLabelText("Python"));

    expect(screen.getByText("Notatki: Python")).toBeTruthy();
    expect(screen.getByText("1 / 2 ofert")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Wyczyść wszystkie filtry" }));

    expect(screen.getByText("2 / 2 ofert")).toBeTruthy();
  });

  it("renders the exact table columns required by the issue", async () => {
    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
    `;

    await import("../../src/web/client/offers-app");

    expect(
      await screen.findAllByRole("columnheader").then((headers) =>
        headers.map((header) => header.textContent?.trim())
      )
    ).toEqual([
      "Stanowisko",
      "Status aplikacji",
      "Data dodania",
      "Firma",
      "Kontrakt",
      "Lokalizacja",
      "Notatki",
      "Widełki od",
      "Widełki do",
      "Ostatnia weryfikacja",
      "Priorytet",
      "Status ogłoszenia",
      "Tryb pracy"
    ]);
  });

  it("lets the user hide a table column", async () => {
    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
    `;

    await import("../../src/web/client/offers-app");

    fireEvent.click(await screen.findByRole("checkbox", { name: "Pokaż kolumnę Firma" }));

    expect(screen.queryByRole("columnheader", { name: "Firma" })).toBeNull();
    expect(screen.queryByText("Acme")).toBeNull();
  });

  it("saves inline edits immediately after changing a select value", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
    `;

    await import("../../src/web/client/offers-app");

    fireEvent.change(await screen.findByLabelText("Status aplikacji dla AI Engineer"), {
      target: { value: "CV wysłane" }
    });

    expect(fetchMock).toHaveBeenCalledWith("/offers/1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status_aplikacji: "CV wysłane" })
    });
    expect(await screen.findByText("Zapisano")).toBeTruthy();
    expect(screen.getByDisplayValue("CV wysłane")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Zapisz zmiany dla AI Engineer" })).toBeNull();
  });

  it("shows an inline error when autosaving an edited field fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false })
    });
    vi.stubGlobal("fetch", fetchMock);

    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
    `;

    await import("../../src/web/client/offers-app");

    fireEvent.change(await screen.findByLabelText("Status aplikacji dla AI Engineer"), {
      target: { value: "CV wysłane" }
    });

    expect(await screen.findByText("Nie udało się zapisać zmian.")).toBeTruthy();
  });
});
