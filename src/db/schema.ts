import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const jobOffers = sqliteTable("job_offers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stanowisko: text("stanowisko").notNull(),
  firma: text("firma").notNull(),
  url: text("url").notNull().unique(),
  widełkiOd: integer("widełki_od"),
  widełkiDo: integer("widełki_do"),
  lokalizacja: text("lokalizacja").notNull(),
  trybPracy: text("tryb_pracy").notNull(),
  kontrakt: text("kontrakt").notNull(),
  statusOgloszenia: text("status_ogloszenia").notNull(),
  statusAplikacji: text("status_aplikacji").notNull(),
  priorytet: text("priorytet").notNull(),
  notatki: text("notatki").notNull(),
  dataDodania: text("data_dodania").notNull(),
  ostatniaWeryfikacja: text("ostatnia_weryfikacja"),
  source: text("source").notNull(),
  sourceExternalId: text("source_external_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const importJobs = sqliteTable("import_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  requestedBy: text("requested_by").notNull(),
  payload: text("payload").notNull(),
  statsFetched: integer("stats_fetched").notNull().default(0),
  statsAdded: integer("stats_added").notNull().default(0),
  statsRejected: integer("stats_rejected").notNull().default(0),
  statsDuplicates: integer("stats_duplicates").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at")
});
