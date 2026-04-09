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

type EditableField = "statusAplikacji" | "priorytet" | "statusOgloszenia" | "notatki";

type EditableOfferDraft = Record<EditableField, string>;

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

function formatDate(value?: string | null) {
  return value ? value.slice(0, 10) : "—";
}

function formatAmount(value?: number | null) {
  return value == null ? "—" : String(value);
}

function getColumnLabel(column: Column<OfferListItem>) {
  return typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;
}

function getEditableDraft(offer: OfferListItem): EditableOfferDraft {
  return {
    statusAplikacji: offer.statusAplikacji ?? "",
    priorytet: offer.priorytet ?? "",
    statusOgloszenia: offer.statusOgloszenia ?? "",
    notatki: offer.notatki ?? ""
  };
}

function getDraftValue(
  drafts: Partial<Record<number, EditableOfferDraft>>,
  offer: OfferListItem,
  field: EditableField
) {
  return drafts[offer.id]?.[field] ?? getEditableDraft(offer)[field];
}

function isDraftDirty(drafts: Partial<Record<number, EditableOfferDraft>>, offer: OfferListItem) {
  const current = getEditableDraft(offer);
  const draft = drafts[offer.id];

  if (!draft) {
    return false;
  }

  return (Object.keys(current) as EditableField[]).some((field) => draft[field] !== current[field]);
}

function mergeOptions(baseOptions: string[], offers: OfferListItem[], field: EditableField) {
  return [...new Set([...baseOptions, ...offers.map((offer) => getEditableDraft(offer)[field]).filter(Boolean)])];
}

function OfferTableApp() {
  const [offers, setOffers] = useState<OfferListItem[]>(() => readInitialOffers());
  const [sorting, setSorting] = useState<SortingState>([]);
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [drafts, setDrafts] = useState<Partial<Record<number, EditableOfferDraft>>>({});
  const [saveStates, setSaveStates] = useState<Partial<Record<number, SaveState>>>({});

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

  const setFieldValue = (offer: OfferListItem, field: EditableField, value: string) => {
    setDrafts((current) => ({
      ...current,
      [offer.id]: {
        ...getEditableDraft(offer),
        ...current[offer.id],
        [field]: value
      }
    }));
    setSaveStates((current) => ({ ...current, [offer.id]: { status: "idle" } }));
  };

  const saveOffer = async (offer: OfferListItem) => {
    const draft = drafts[offer.id] ?? getEditableDraft(offer);
    const payload: Record<string, string> = {};
    const nextOffer: OfferListItem = { ...offer };

    if (draft.statusAplikacji !== (offer.statusAplikacji ?? "")) {
      payload.status_aplikacji = draft.statusAplikacji;
      nextOffer.statusAplikacji = draft.statusAplikacji;
    }

    if (draft.priorytet !== (offer.priorytet ?? "")) {
      payload.priorytet = draft.priorytet;
      nextOffer.priorytet = draft.priorytet;
    }

    if (draft.statusOgloszenia !== (offer.statusOgloszenia ?? "")) {
      payload.status_ogloszenia = draft.statusOgloszenia;
      nextOffer.statusOgloszenia = draft.statusOgloszenia;
    }

    if (draft.notatki !== (offer.notatki ?? "")) {
      payload.notatki = draft.notatki;
      nextOffer.notatki = draft.notatki;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    setSaveStates((current) => ({
      ...current,
      [offer.id]: { status: "saving", message: "Zapisywanie..." }
    }));

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

      setOffers((current) => current.map((item) => (item.id === offer.id ? nextOffer : item)));
      setDrafts((current) => {
        const next = { ...current };
        delete next[offer.id];
        return next;
      });
      setSaveStates((current) => ({
        ...current,
        [offer.id]: { status: "success", message: "Zapisano" }
      }));
    } catch {
      setSaveStates((current) => ({
        ...current,
        [offer.id]: { status: "error", message: "Nie udało się zapisać zmian." }
      }));
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
          const isDirty = isDraftDirty(drafts, row.original);
          const saveState = saveStates[row.original.id] ?? { status: "idle" };

          return (
            <div className="inline-editor">
              <label className="sr-only" htmlFor={`status-aplikacji-${row.original.id}`}>
                Status aplikacji dla {row.original.stanowisko}
              </label>
              <select
                className="edit-select"
                id={`status-aplikacji-${row.original.id}`}
                onChange={(event) => setFieldValue(row.original, "statusAplikacji", event.target.value)}
                value={getDraftValue(drafts, row.original, "statusAplikacji")}
              >
                {statusAplikacjiOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <div className="save-actions">
                <button
                  aria-label={`Zapisz zmiany dla ${row.original.stanowisko}`}
                  className="save-button"
                  disabled={!isDirty || saveState.status === "saving"}
                  onClick={() => void saveOffer(row.original)}
                  type="button"
                >
                  Zapisz
                </button>
                {saveState.status === "saving" || saveState.status === "success" || saveState.status === "error" ? (
                  <span
                    aria-live="polite"
                    className={saveState.status === "error" ? "save-feedback save-feedback-error" : "save-feedback"}
                  >
                    {saveState.message}
                  </span>
                ) : null}
              </div>
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
          <div className="inline-editor">
            <label className="sr-only" htmlFor={`notatki-${row.original.id}`}>
              Notatki dla {row.original.stanowisko}
            </label>
            <input
              className="edit-input"
              id={`notatki-${row.original.id}`}
              onChange={(event) => setFieldValue(row.original, "notatki", event.target.value)}
              type="text"
              value={getDraftValue(drafts, row.original, "notatki")}
            />
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
        cell: ({ row }) => (
          <>
            <label className="sr-only" htmlFor={`priorytet-${row.original.id}`}>
              Priorytet dla {row.original.stanowisko}
            </label>
            <select
              className="edit-select"
              id={`priorytet-${row.original.id}`}
              onChange={(event) => setFieldValue(row.original, "priorytet", event.target.value)}
              value={getDraftValue(drafts, row.original, "priorytet")}
            >
              {priorytetOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </>
        )
      },
      {
        accessorKey: "statusOgloszenia",
        header: "Status ogłoszenia",
        cell: ({ row }) => (
          <>
            <label className="sr-only" htmlFor={`status-ogloszenia-${row.original.id}`}>
              Status ogłoszenia dla {row.original.stanowisko}
            </label>
            <select
              className="edit-select"
              id={`status-ogloszenia-${row.original.id}`}
              onChange={(event) => setFieldValue(row.original, "statusOgloszenia", event.target.value)}
              value={getDraftValue(drafts, row.original, "statusOgloszenia")}
            >
              {statusOgloszeniaOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </>
        )
      },
      {
        accessorKey: "trybPracy",
        header: "Tryb pracy"
      }
    ],
    [activeLabels, drafts, priorytetOptions, saveStates, statusAplikacjiOptions, statusOgloszeniaOptions]
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

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">Job Tracker</p>
          <h1>Oferty dopasowane do profilu</h1>
        </div>
        <p className="summary">
          {filteredOffers.length} / {offers.length} ofert
        </p>
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
