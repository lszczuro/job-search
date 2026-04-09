import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type VisibilityState,
  type SortingState
} from "@tanstack/react-table";
import { getOfferLabels, getOfferNoteLabels, type OfferListItem } from "../offer-view-model";

type EditableField = "statusAplikacji" | "priorytet" | "statusOgloszenia";

type SaveState =
  | { status: "idle" }
  | { status: "saving"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const STATUS_APLIKACJI_OPTIONS = [
  "📋 Zapisana",
  "CV wysłane",
  "📞 Rozmowa HR",
  "💬 Rozmowa techniczna",
  "✅ Oferta",
  "❌ Odrzucona"
];

const PRIORYTET_OPTIONS = ["🔥 Teraz", "👀 Obserwuj", "⏳ Później"];

const STATUS_OGLOSZENIA_OPTIONS = ["🟢 Aktywne", "⏸️ Wstrzymane", "🔴 Zamknięte"];

function readInitialOffers() {
  const payload = document.getElementById("initial-offers")?.textContent ?? "[]";
  return JSON.parse(payload) as OfferListItem[];
}

type RefreshMeta = {
  timezone: string;
  lastUpdatedAt: string | null;
};

function readRefreshMeta() {
  const payload = document.getElementById("initial-refresh-meta")?.textContent;

  if (!payload) {
    return {
      timezone: "Europe/Warsaw",
      lastUpdatedAt: null
    } satisfies RefreshMeta;
  }

  return JSON.parse(payload) as RefreshMeta;
}

function formatDate(value?: string | null) {
  return value ? value.slice(0, 10) : "—";
}

function formatAmount(value?: number | null) {
  return value == null ? "—" : String(value);
}

function formatRefreshTimestamp(value: string | null, timezone: string) {
  if (!value) {
    return "Jeszcze nie odświeżono";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone
  }).format(new Date(value));
}

function getColumnLabel(column: Column<OfferListItem>) {
  return typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;
}

function getFieldValue(offer: OfferListItem, field: EditableField) {
  if (field === "statusAplikacji") {
    return offer.statusAplikacji ?? "";
  }

  if (field === "priorytet") {
    return offer.priorytet ?? "";
  }

  return offer.statusOgloszenia ?? "";
}

function mergeOptions(baseOptions: string[], offers: OfferListItem[], field: EditableField) {
  return [...new Set([...baseOptions, ...offers.map((offer) => getFieldValue(offer, field)).filter(Boolean)])];
}

function OfferTableApp() {
  const [offers, setOffers] = useState<OfferListItem[]>(() => readInitialOffers());
  const [refreshMeta] = useState<RefreshMeta>(() => readRefreshMeta());
  const [sorting, setSorting] = useState<SortingState>([]);
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [saveStates, setSaveStates] = useState<Partial<Record<number, Partial<Record<EditableField, SaveState>>>>>({});

  const labels = useMemo(
    () => [...new Set(offers.flatMap((offer) => getOfferLabels(offer)))].sort((a, b) => a.localeCompare(b)),
    [offers]
  );
  const statusAplikacjiOptions = useMemo(
    () => mergeOptions(STATUS_APLIKACJI_OPTIONS, offers, "statusAplikacji"),
    [offers]
  );
  const priorytetOptions = useMemo(() => mergeOptions(PRIORYTET_OPTIONS, offers, "priorytet"), [offers]);
  const statusOgloszeniaOptions = useMemo(
    () => mergeOptions(STATUS_OGLOSZENIA_OPTIONS, offers, "statusOgloszenia"),
    [offers]
  );
  const filteredOffers = useMemo(
    () =>
      offers.filter((offer) => {
        if (activeLabels.length === 0) {
          return true;
        }

        const offerLabels = getOfferLabels(offer);
        return activeLabels.every((label) => offerLabels.includes(label));
      }),
    [activeLabels, offers]
  );

  const setFieldSaveState = (offerId: number, field: EditableField, state: SaveState) => {
    setSaveStates((current) => ({
      ...current,
      [offerId]: {
        ...current[offerId],
        [field]: state
      }
    }));
  };

  const saveOfferField = async (offer: OfferListItem, field: EditableField, value: string) => {
    const previousValue = getFieldValue(offer, field);

    if (previousValue === value) {
      return;
    }

    const payload =
      field === "statusAplikacji"
        ? { status_aplikacji: value }
        : field === "priorytet"
          ? { priorytet: value }
          : { status_ogloszenia: value };

    setOffers((current) =>
      current.map((item) => (item.id === offer.id ? { ...item, [field]: value } : item))
    );
    setFieldSaveState(offer.id, field, { status: "saving", message: "Zapisywanie..." });

    try {
      const response = await fetch(`/offers/${offer.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;

      if (!response.ok || result?.ok === false) {
        throw new Error("SAVE_FAILED");
      }

      setFieldSaveState(offer.id, field, { status: "success", message: "Zapisano" });
    } catch {
      setOffers((current) =>
        current.map((item) => (item.id === offer.id ? { ...item, [field]: previousValue } : item))
      );
      setFieldSaveState(offer.id, field, { status: "error", message: "Nie udało się zapisać zmian." });
    }
  };

  const columns: Array<ColumnDef<OfferListItem>> = useMemo(
    () => [
      {
        accessorKey: "stanowisko",
        header: "Stanowisko",
        cell: ({ row }) => (
          <a href={row.original.url ?? "#"} rel="noreferrer" target="_blank">
            {row.original.stanowisko}
          </a>
        )
      },
      {
        accessorKey: "statusAplikacji",
        header: "Status aplikacji",
        cell: ({ row }) => {
          const saveState = saveStates[row.original.id]?.statusAplikacji ?? { status: "idle" };

          return (
            <div className="inline-editor">
              <label className="sr-only" htmlFor={`status-aplikacji-${row.original.id}`}>
                Status aplikacji dla {row.original.stanowisko}
              </label>
              <select
                className="edit-select"
                disabled={saveState.status === "saving"}
                id={`status-aplikacji-${row.original.id}`}
                onChange={(event) => void saveOfferField(row.original, "statusAplikacji", event.target.value)}
                value={row.original.statusAplikacji ?? ""}
              >
                {statusAplikacjiOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {saveState.status === "saving" || saveState.status === "success" || saveState.status === "error" ? (
                <span
                  aria-live="polite"
                  className={saveState.status === "error" ? "save-feedback save-feedback-error" : "save-feedback"}
                >
                  {saveState.message}
                </span>
              ) : null}
            </div>
          );
        }
      },
      {
        accessorKey: "dataDodania",
        header: "Data dodania",
        cell: ({ row }) => formatDate(row.original.dataDodania)
      },
      {
        accessorKey: "firma",
        header: "Firma"
      },
      {
        accessorKey: "kontrakt",
        header: "Kontrakt"
      },
      {
        accessorKey: "lokalizacja",
        header: "Lokalizacja"
      },
      {
        id: "notatki",
        header: "Notatki",
        cell: ({ row }) => (
          <div className="labels">
            {getOfferNoteLabels(row.original).map((label) => {
              const isActive = activeLabels.includes(label);

              return (
                <button
                  className={isActive ? "chip chip-active" : "chip"}
                  key={label}
                  onClick={() =>
                    setActiveLabels((current) =>
                      isActive ? current.filter((item) => item !== label) : [...current, label]
                    )
                  }
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        ),
        sortingFn: (left, right) =>
          getOfferNoteLabels(left.original)
            .join(",")
            .localeCompare(getOfferNoteLabels(right.original).join(","))
      },
      {
        accessorKey: "widełkiOd",
        header: "Widełki od",
        cell: ({ row }) => formatAmount(row.original.widełkiOd)
      },
      {
        accessorKey: "widełkiDo",
        header: "Widełki do",
        cell: ({ row }) => formatAmount(row.original.widełkiDo)
      },
      {
        accessorKey: "ostatniaWeryfikacja",
        header: "Ostatnia weryfikacja",
        cell: ({ row }) => formatDate(row.original.ostatniaWeryfikacja)
      },
      {
        accessorKey: "priorytet",
        header: "Priorytet",
        cell: ({ row }) => {
          const saveState = saveStates[row.original.id]?.priorytet ?? { status: "idle" };

          return (
            <div className="inline-editor">
              <label className="sr-only" htmlFor={`priorytet-${row.original.id}`}>
                Priorytet dla {row.original.stanowisko}
              </label>
              <select
                className="edit-select"
                disabled={saveState.status === "saving"}
                id={`priorytet-${row.original.id}`}
                onChange={(event) => void saveOfferField(row.original, "priorytet", event.target.value)}
                value={row.original.priorytet ?? ""}
              >
                {priorytetOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {saveState.status === "saving" || saveState.status === "success" || saveState.status === "error" ? (
                <span
                  aria-live="polite"
                  className={saveState.status === "error" ? "save-feedback save-feedback-error" : "save-feedback"}
                >
                  {saveState.message}
                </span>
              ) : null}
            </div>
          );
        }
      },
      {
        accessorKey: "statusOgloszenia",
        header: "Status ogłoszenia",
        cell: ({ row }) => {
          const saveState = saveStates[row.original.id]?.statusOgloszenia ?? { status: "idle" };

          return (
            <div className="inline-editor">
              <label className="sr-only" htmlFor={`status-ogloszenia-${row.original.id}`}>
                Status ogłoszenia dla {row.original.stanowisko}
              </label>
              <select
                className="edit-select"
                disabled={saveState.status === "saving"}
                id={`status-ogloszenia-${row.original.id}`}
                onChange={(event) => void saveOfferField(row.original, "statusOgloszenia", event.target.value)}
                value={row.original.statusOgloszenia ?? ""}
              >
                {statusOgloszeniaOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {saveState.status === "saving" || saveState.status === "success" || saveState.status === "error" ? (
                <span
                  aria-live="polite"
                  className={saveState.status === "error" ? "save-feedback save-feedback-error" : "save-feedback"}
                >
                  {saveState.message}
                </span>
              ) : null}
            </div>
          );
        }
      },
      {
        accessorKey: "trybPracy",
        header: "Tryb pracy"
      }
    ],
    [activeLabels, priorytetOptions, saveStates, statusAplikacjiOptions, statusOgloszeniaOptions]
  );

  const table = useReactTable({
    data: filteredOffers,
    columns,
    state: {
      sorting,
      columnVisibility
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  async function handleRefreshClick() {
    await fetch("/imports/refresh", {
      method: "POST"
    });
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">Job Tracker</p>
          <h1>Oferty dopasowane do profilu</h1>
          <p className="summary">
            Ostatni update: {formatRefreshTimestamp(refreshMeta.lastUpdatedAt, refreshMeta.timezone)}
          </p>
        </div>
        <div>
          <button onClick={() => void handleRefreshClick()} type="button">
            Odśwież oferty
          </button>
          <p className="summary">
            {filteredOffers.length} / {offers.length} ofert
          </p>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-group">
          <span>Filtr labeli</span>
          <div className="labels">
            {labels.map((label) => {
              const isActive = activeLabels.includes(label);

              return (
                <button
                  className={isActive ? "chip chip-active" : "chip"}
                  key={label}
                  onClick={() =>
                    setActiveLabels((current) =>
                      isActive ? current.filter((item) => item !== label) : [...current, label]
                    )
                  }
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="toolbar-group">
          <span>Widoczne kolumny</span>
          <div className="column-toggles">
            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                const label = getColumnLabel(column);

                return (
                  <label className="toggle-chip" key={column.id}>
                    <input
                      aria-label={`Pokaż kolumnę ${label}`}
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                      type="checkbox"
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
          </div>
        </div>
      </div>

      {filteredOffers.length === 0 ? (
        <p className="empty-state">Brak ofert dla wybranych labeli.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id}>
                      {header.isPlaceholder ? null : (
                        <button
                          className="sort-button"
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc"
                            ? " ↑"
                            : header.column.getIsSorted() === "desc"
                              ? " ↓"
                              : ""}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const rootElement = document.getElementById("offers-app");

if (rootElement) {
  createRoot(rootElement).render(<OfferTableApp />);
}
