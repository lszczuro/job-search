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

function OfferTableApp() {
  const [offers] = useState<OfferListItem[]>(() => readInitialOffers());
  const [sorting, setSorting] = useState<SortingState>([]);
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const labels = useMemo(
    () => [...new Set(offers.flatMap((offer) => getOfferLabels(offer)))].sort((a, b) => a.localeCompare(b)),
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
        header: "Status aplikacji"
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
        header: "Priorytet"
      },
      {
        accessorKey: "statusOgloszenia",
        header: "Status ogłoszenia"
      },
      {
        accessorKey: "trybPracy",
        header: "Tryb pracy"
      }
    ],
    [activeLabels]
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
