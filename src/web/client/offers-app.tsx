import { useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  type VisibilityState
} from "@tanstack/react-table";
import { getOfferNoteLabels, type OfferListItem } from "../offer-view-model";

type MultiSelectFilterValue = string[];
type NumericRangeFilterValue = { min?: string; max?: string };

type OfferColumnFilterMeta = {
  filterVariant?: "text" | "date" | "multi-select" | "note-select" | "number-range";
  filterLabel?: string;
  getOptions?: (offers: OfferListItem[]) => string[];
};

type EditableField = "statusAplikacji" | "priorytet" | "statusOgloszenia";

type SaveState =
  | { status: "idle" }
  | { status: "saving"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type CreateOfferFormState = {
  stanowisko: string;
  firma: string;
  url: string;
};

type CreateOfferState =
  | { status: "idle"; message: string | null }
  | { status: "saving"; message: string | null }
  | { status: "error"; message: string };

type CreateOfferResponse = {
  id: number;
  stanowisko: string;
  firma: string;
  url: string;
  status_aplikacji?: string;
  priorytet?: string;
  status_ogloszenia?: string;
  lokalizacja?: string;
  tryb_pracy?: string;
  kontrakt?: string;
  notatki?: string;
  data_dodania?: string;
  ostatnia_weryfikacja?: string | null;
  widełki_od?: number | null;
  widełki_do?: number | null;
};

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

function normalizeDate(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function buildUniqueOptions(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b));
}

function getInitialCreateForm(): CreateOfferFormState {
  return {
    stanowisko: "",
    firma: "",
    url: ""
  };
}

function getCreateErrorMessage(errorCode?: string) {
  if (errorCode === "DUPLICATE_URL") {
    return "Oferta z tym URL już istnieje.";
  }

  if (errorCode === "INVALID_PAYLOAD") {
    return "Uzupełnij stanowisko, firmę i poprawny URL.";
  }

  return "Nie udało się dodać oferty.";
}

function mapCreatedOfferToListItem(offer: CreateOfferResponse): OfferListItem {
  return {
    id: offer.id,
    stanowisko: offer.stanowisko,
    firma: offer.firma,
    url: offer.url,
    statusAplikacji: offer.status_aplikacji ?? "📋 Zapisana",
    priorytet: offer.priorytet ?? "🔥 Teraz",
    statusOgloszenia: offer.status_ogloszenia ?? "🟢 Aktywne",
    lokalizacja: offer.lokalizacja ?? "Brak danych",
    trybPracy: offer.tryb_pracy ?? "Nieznany",
    kontrakt: offer.kontrakt ?? "Nieznany",
    notatki: offer.notatki ?? "",
    dataDodania: offer.data_dodania ?? new Date().toISOString().slice(0, 10),
    ostatniaWeryfikacja: offer.ostatnia_weryfikacja ?? null,
    widełkiOd: offer.widełki_od ?? null,
    widełkiDo: offer.widełki_do ?? null
  };
}

function getColumnLabel(column: Column<OfferListItem>) {
  return typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;
}

function getFieldValue(offer: OfferListItem, field: EditableField) {
  if (field === "statusAplikacji") return offer.statusAplikacji ?? "";
  if (field === "priorytet") return offer.priorytet ?? "";
  return offer.statusOgloszenia ?? "";
}

function mergeOptions(baseOptions: string[], offers: OfferListItem[], field: EditableField) {
  return [...new Set([...baseOptions, ...offers.map((o) => getFieldValue(o, field)).filter(Boolean)])];
}

const textIncludesFilter: FilterFn<OfferListItem> = (row, columnId, value) => {
  const cellValue = String(row.getValue(columnId) ?? "").toLowerCase();
  return cellValue.includes(String(value ?? "").toLowerCase());
};

const exactDateFilter: FilterFn<OfferListItem> = (row, columnId, value) => {
  const cellValue = normalizeDate(String(row.getValue(columnId) ?? ""));
  return !value ? true : cellValue === value;
};

const multiSelectFilter: FilterFn<OfferListItem> = (row, columnId, value: MultiSelectFilterValue) => {
  if (!value?.length) return true;
  return value.includes(String(row.getValue(columnId) ?? ""));
};

const notesFilter: FilterFn<OfferListItem> = (row, _columnId, value: MultiSelectFilterValue) => {
  if (!value?.length) return true;
  const labels = getOfferNoteLabels(row.original);
  return value.some((item) => labels.includes(item));
};

const numberRangeFilter: FilterFn<OfferListItem> = (row, columnId, value: NumericRangeFilterValue) => {
  const rawValue = row.getValue(columnId);
  const num = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (Number.isNaN(num)) return false;
  if (value.min && num < Number(value.min)) return false;
  if (value.max && num > Number(value.max)) return false;
  return true;
};

function FilterDropdown({
  column,
  meta,
  offers
}: {
  column: Column<OfferListItem, unknown>;
  meta: OfferColumnFilterMeta;
  offers: OfferListItem[];
}) {
  const [open, setOpen] = useState(false);
  const selectedValues = (column.getFilterValue() as MultiSelectFilterValue | undefined) ?? [];
  const options = meta.getOptions ? meta.getOptions(offers) : [];

  const handleChange = (option: string, checked: boolean) => {
    const next = checked ? [...selectedValues, option] : selectedValues.filter((v) => v !== option);
    column.setFilterValue(next.length ? next : undefined);
  };

  return (
    <div className="filter-dropdown">
      <button
        aria-expanded={open}
        aria-label={meta.filterLabel}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        {selectedValues.length > 0 ? `${selectedValues.length} wybrane` : "Wybierz"}
      </button>
      {open && (
        <div className="filter-panel">
          {options.map((option) => (
            <label key={option}>
              <input
                checked={selectedValues.includes(option)}
                onChange={(e) => handleChange(option, e.target.checked)}
                type="checkbox"
              />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function renderColumnFilter(column: Column<OfferListItem, unknown>, offers: OfferListItem[]) {
  const meta = column.columnDef.meta as OfferColumnFilterMeta | undefined;
  if (!meta?.filterVariant) return null;

  if (meta.filterVariant === "text") {
    return (
      <input
        aria-label={meta.filterLabel}
        className="filter-input"
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
        value={(column.getFilterValue() as string) ?? ""}
      />
    );
  }

  if (meta.filterVariant === "date") {
    return (
      <input
        aria-label={meta.filterLabel}
        className="filter-input"
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
        type="date"
        value={(column.getFilterValue() as string) ?? ""}
      />
    );
  }

  if (meta.filterVariant === "number-range") {
    const value = (column.getFilterValue() as NumericRangeFilterValue | undefined) ?? {};
    return (
      <div className="filter-range">
        <input
          aria-label={`${meta.filterLabel} min`}
          className="filter-input"
          onChange={(e) => column.setFilterValue({ ...value, min: e.target.value || undefined })}
          placeholder="min"
          type="number"
          value={value.min ?? ""}
        />
        <input
          aria-label={`${meta.filterLabel} max`}
          className="filter-input"
          onChange={(e) => column.setFilterValue({ ...value, max: e.target.value || undefined })}
          placeholder="max"
          type="number"
          value={value.max ?? ""}
        />
      </div>
    );
  }

  return <FilterDropdown column={column} meta={meta} offers={offers} />;
}

function OfferTableApp() {
  const [offers, setOffers] = useState<OfferListItem[]>(() => readInitialOffers());
  const [refreshMeta] = useState<RefreshMeta>(() => readRefreshMeta());
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [saveStates, setSaveStates] = useState<Partial<Record<number, Partial<Record<EditableField, SaveState>>>>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateOfferFormState>(() => getInitialCreateForm());
  const [createState, setCreateState] = useState<CreateOfferState>({ status: "idle", message: null });

  const statusAplikacjiOptions = mergeOptions(STATUS_APLIKACJI_OPTIONS, offers, "statusAplikacji");
  const priorytetOptions = mergeOptions(PRIORYTET_OPTIONS, offers, "priorytet");
  const statusOgloszeniaOptions = mergeOptions(STATUS_OGLOSZENIA_OPTIONS, offers, "statusOgloszenia");

  const setFieldSaveState = (offerId: number, field: EditableField, state: SaveState) => {
    setSaveStates((current) => ({
      ...current,
      [offerId]: { ...current[offerId], [field]: state }
    }));
  };

  const saveOfferField = async (offer: OfferListItem, field: EditableField, value: string) => {
    const previousValue = getFieldValue(offer, field);
    if (previousValue === value) return;

    const payload =
      field === "statusAplikacji"
        ? { status_aplikacji: value }
        : field === "priorytet"
          ? { priorytet: value }
          : { status_ogloszenia: value };

    setOffers((current) => current.map((item) => (item.id === offer.id ? { ...item, [field]: value } : item)));
    setFieldSaveState(offer.id, field, { status: "saving", message: "Zapisywanie..." });

    try {
      const response = await fetch(`/offers/${offer.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;

      if (!response.ok || result?.ok === false) throw new Error("SAVE_FAILED");

      setFieldSaveState(offer.id, field, { status: "success", message: "Zapisano" });
    } catch {
      setOffers((current) =>
        current.map((item) => (item.id === offer.id ? { ...item, [field]: previousValue } : item))
      );
      setFieldSaveState(offer.id, field, { status: "error", message: "Nie udało się zapisać zmian." });
    }
  };

  const columns: Array<ColumnDef<OfferListItem>> = [
    {
      accessorKey: "stanowisko",
      header: "Stanowisko",
      filterFn: textIncludesFilter,
      meta: { filterVariant: "text", filterLabel: "Filtr Stanowisko" } as OfferColumnFilterMeta,
      cell: ({ row }) => (
        <a href={row.original.url ?? "#"} rel="noreferrer" target="_blank">
          {row.original.stanowisko}
        </a>
      )
    },
    {
      accessorKey: "statusAplikacji",
      header: "Status aplikacji",
      filterFn: multiSelectFilter,
      meta: {
        filterVariant: "multi-select",
        filterLabel: "Filtr Status aplikacji",
        getOptions: () => statusAplikacjiOptions
      } as OfferColumnFilterMeta,
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
              onChange={(e) => void saveOfferField(row.original, "statusAplikacji", e.target.value)}
              value={row.original.statusAplikacji ?? ""}
            >
              {statusAplikacjiOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {(saveState.status === "saving" || saveState.status === "success" || saveState.status === "error") && (
              <span
                aria-live="polite"
                className={saveState.status === "error" ? "save-feedback save-feedback-error" : "save-feedback"}
              >
                {saveState.message}
              </span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: "dataDodania",
      header: "Data dodania",
      filterFn: exactDateFilter,
      meta: { filterVariant: "date", filterLabel: "Filtr Data dodania" } as OfferColumnFilterMeta,
      cell: ({ row }) => formatDate(row.original.dataDodania)
    },
    {
      accessorKey: "firma",
      header: "Firma",
      filterFn: textIncludesFilter,
      meta: { filterVariant: "text", filterLabel: "Filtr Firma" } as OfferColumnFilterMeta
    },
    {
      accessorKey: "kontrakt",
      header: "Kontrakt",
      filterFn: multiSelectFilter,
      meta: {
        filterVariant: "multi-select",
        filterLabel: "Filtr Kontrakt",
        getOptions: (allOffers) => buildUniqueOptions(allOffers.map((o) => o.kontrakt))
      } as OfferColumnFilterMeta
    },
    {
      accessorKey: "lokalizacja",
      header: "Lokalizacja",
      filterFn: textIncludesFilter,
      meta: { filterVariant: "text", filterLabel: "Filtr Lokalizacja" } as OfferColumnFilterMeta
    },
    {
      accessorKey: "notatki",
      header: "Notatki",
      filterFn: notesFilter,
      meta: {
        filterVariant: "note-select",
        filterLabel: "Filtr Notatki",
        getOptions: (allOffers) => buildUniqueOptions(allOffers.flatMap((o) => getOfferNoteLabels(o)))
      } as OfferColumnFilterMeta,
      cell: ({ row }) => (
        <div className="labels">
          {getOfferNoteLabels(row.original).map((label) => (
            <span className="chip" key={label}>
              {label}
            </span>
          ))}
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
      filterFn: numberRangeFilter,
      meta: { filterVariant: "number-range", filterLabel: "Filtr Widełki od" } as OfferColumnFilterMeta,
      cell: ({ row }) => formatAmount(row.original.widełkiOd)
    },
    {
      accessorKey: "widełkiDo",
      header: "Widełki do",
      filterFn: numberRangeFilter,
      meta: { filterVariant: "number-range", filterLabel: "Filtr Widełki do" } as OfferColumnFilterMeta,
      cell: ({ row }) => formatAmount(row.original.widełkiDo)
    },
    {
      accessorKey: "ostatniaWeryfikacja",
      header: "Ostatnia weryfikacja",
      filterFn: exactDateFilter,
      meta: { filterVariant: "date", filterLabel: "Filtr Ostatnia weryfikacja" } as OfferColumnFilterMeta,
      cell: ({ row }) => formatDate(row.original.ostatniaWeryfikacja)
    },
    {
      accessorKey: "priorytet",
      header: "Priorytet",
      filterFn: multiSelectFilter,
      meta: {
        filterVariant: "multi-select",
        filterLabel: "Filtr Priorytet",
        getOptions: () => priorytetOptions
      } as OfferColumnFilterMeta,
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
              onChange={(e) => void saveOfferField(row.original, "priorytet", e.target.value)}
              value={row.original.priorytet ?? ""}
            >
              {priorytetOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {(saveState.status === "saving" || saveState.status === "success" || saveState.status === "error") && (
              <span
                aria-live="polite"
                className={saveState.status === "error" ? "save-feedback save-feedback-error" : "save-feedback"}
              >
                {saveState.message}
              </span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: "statusOgloszenia",
      header: "Status ogłoszenia",
      filterFn: multiSelectFilter,
      meta: {
        filterVariant: "multi-select",
        filterLabel: "Filtr Status ogłoszenia",
        getOptions: () => statusOgloszeniaOptions
      } as OfferColumnFilterMeta,
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
              onChange={(e) => void saveOfferField(row.original, "statusOgloszenia", e.target.value)}
              value={row.original.statusOgloszenia ?? ""}
            >
              {statusOgloszeniaOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {(saveState.status === "saving" || saveState.status === "success" || saveState.status === "error") && (
              <span
                aria-live="polite"
                className={saveState.status === "error" ? "save-feedback save-feedback-error" : "save-feedback"}
              >
                {saveState.message}
              </span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: "trybPracy",
      header: "Tryb pracy",
      filterFn: multiSelectFilter,
      meta: {
        filterVariant: "multi-select",
        filterLabel: "Filtr Tryb pracy",
        getOptions: (allOffers) => buildUniqueOptions(allOffers.map((o) => o.trybPracy))
      } as OfferColumnFilterMeta
    }
  ];

  const table = useReactTable({
    data: offers,
    columns,
    state: { sorting, columnVisibility, columnFilters },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  async function handleRefreshClick() {
    await fetch("/imports/refresh", {
      method: "POST"
    });
  }

  function openCreateModal() {
    setCreateForm(getInitialCreateForm());
    setCreateState({ status: "idle", message: null });
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (createState.status === "saving") return;
    setIsCreateModalOpen(false);
    setCreateState({ status: "idle", message: null });
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      stanowisko: createForm.stanowisko.trim(),
      firma: createForm.firma.trim(),
      url: createForm.url.trim()
    };

    if (!payload.stanowisko || !payload.firma || !payload.url) {
      setCreateState({ status: "error", message: getCreateErrorMessage("INVALID_PAYLOAD") });
      return;
    }

    setCreateState({ status: "saving", message: null });

    try {
      const response = await fetch("/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => null)) as
        | ({ ok?: boolean; error?: string } & Partial<CreateOfferResponse>)
        | null;

      if (!response.ok || !result || typeof result.id !== "number") {
        setCreateState({ status: "error", message: getCreateErrorMessage(result?.error) });
        return;
      }

      setOffers((current) => [mapCreatedOfferToListItem(result as CreateOfferResponse), ...current]);
      setIsCreateModalOpen(false);
      setCreateForm(getInitialCreateForm());
      setCreateState({ status: "idle", message: null });
    } catch {
      setCreateState({ status: "error", message: getCreateErrorMessage() });
    }
  }

  const activeFilterChips = columnFilters.flatMap((cf) => {
    const col = table.getColumn(cf.id);
    const headerLabel = col ? getColumnLabel(col) : cf.id;

    let label: string | null = null;
    if (Array.isArray(cf.value)) {
      const strValues = cf.value as string[];
      if (strValues.length) label = `${headerLabel}: ${strValues.join(", ")}`;
    } else if (typeof cf.value === "string" && cf.value) {
      label = `${headerLabel}: ${cf.value}`;
    }

    if (!label) return [];
    return [{ id: cf.id, label }];
  });

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
          <div className="header-actions">
            <button className="refresh-button" onClick={openCreateModal} type="button">
              Dodaj ręcznie
            </button>
            <button className="refresh-button" onClick={() => void handleRefreshClick()} type="button">
              Odśwież oferty
            </button>
          </div>
        </div>
      </div>

      <div className="toolbar">
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

      <div className="active-filters">
        <span>
          {table.getRowModel().rows.length} / {offers.length} ofert
        </span>
        {activeFilterChips.map((chip) => (
          <span key={chip.id}>
            <span>{chip.label}</span>
            <button onClick={() => table.getColumn(chip.id)?.setFilterValue(undefined)} type="button">
              ×
            </button>
          </span>
        ))}
        {columnFilters.length > 0 && (
          <button onClick={() => setColumnFilters([])} type="button">
            Wyczyść wszystkie filtry
          </button>
        )}
      </div>

      {table.getRowModel().rows.length === 0 ? (
        <p className="empty-state">Brak ofert dla aktywnych filtrów.</p>
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
              <tr>
                {table.getHeaderGroups()[0]?.headers.map((header) => (
                  <td key={`filter-${header.id}`}>{renderColumnFilter(header.column, offers)}</td>
                ))}
              </tr>
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

      {isCreateModalOpen && (
        <div aria-modal="true" className="modal-backdrop" role="dialog" aria-label="Dodaj ofertę ręcznie">
          <div className="modal-card">
            <h2>Dodaj ofertę ręcznie</h2>
            <form className="manual-form" onSubmit={(event) => void handleCreateSubmit(event)}>
              <label>
                <span>Stanowisko</span>
                <input
                  className="edit-input"
                  disabled={createState.status === "saving"}
                  name="stanowisko"
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, stanowisko: event.target.value }))
                  }
                  value={createForm.stanowisko}
                />
              </label>
              <label>
                <span>Firma</span>
                <input
                  className="edit-input"
                  disabled={createState.status === "saving"}
                  name="firma"
                  onChange={(event) => setCreateForm((current) => ({ ...current, firma: event.target.value }))}
                  value={createForm.firma}
                />
              </label>
              <label>
                <span>URL</span>
                <input
                  className="edit-input"
                  disabled={createState.status === "saving"}
                  name="url"
                  onChange={(event) => setCreateForm((current) => ({ ...current, url: event.target.value }))}
                  type="url"
                  value={createForm.url}
                />
              </label>
              {createState.status === "error" && (
                <p aria-live="polite" className="save-feedback save-feedback-error">
                  {createState.message}
                </p>
              )}
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  disabled={createState.status === "saving"}
                  onClick={closeCreateModal}
                  type="button"
                >
                  Anuluj
                </button>
                <button className="save-button" disabled={createState.status === "saving"} type="submit">
                  {createState.status === "saving" ? "Zapisywanie..." : "Dodaj rekord"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const rootElement = document.getElementById("offers-app");

if (rootElement) {
  createRoot(rootElement).render(<OfferTableApp />);
}
