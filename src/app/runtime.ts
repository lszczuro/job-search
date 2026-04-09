import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { parseEnv } from "../config/env";
import { runImport } from "../core/importing/run-import";
import { searchJobsViaMcp } from "../adapters/czyjesteldorado/mcp-client";
import type { OfferListItem } from "../web/offer-view-model";

function ensureSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS job_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stanowisko TEXT NOT NULL,
      firma TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      widełki_od INTEGER,
      widełki_do INTEGER,
      lokalizacja TEXT NOT NULL,
      tryb_pracy TEXT NOT NULL,
      kontrakt TEXT NOT NULL,
      status_ogloszenia TEXT NOT NULL,
      status_aplikacji TEXT NOT NULL,
      priorytet TEXT NOT NULL,
      notatki TEXT NOT NULL,
      data_dodania TEXT NOT NULL,
      ostatnia_weryfikacja TEXT,
      source TEXT NOT NULL,
      source_external_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      payload TEXT NOT NULL,
      stats_fetched INTEGER NOT NULL DEFAULT 0,
      stats_added INTEGER NOT NULL DEFAULT 0,
      stats_rejected INTEGER NOT NULL DEFAULT 0,
      stats_duplicates INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT
    );
  `);
}

export function createRuntimeDeps(env = process.env) {
  const config = parseEnv(env);
  mkdirSync(dirname(config.databasePath), { recursive: true });
  const sqlite = new Database(config.databasePath);

  ensureSchema(sqlite);

  return {
    async listOffers() {
      return sqlite
        .prepare(
          `
            SELECT
              id,
              stanowisko,
              status_aplikacji AS statusAplikacji,
              data_dodania AS dataDodania,
              firma,
              url,
              kontrakt,
              lokalizacja,
              notatki,
              widełki_od AS widełkiOd,
              widełki_do AS widełkiDo,
              ostatnia_weryfikacja AS ostatniaWeryfikacja,
              priorytet,
              status_ogloszenia AS statusOgloszenia,
              tryb_pracy AS trybPracy
            FROM job_offers
            ORDER BY datetime(created_at) DESC
            LIMIT 100
          `
        )
        .all() as OfferListItem[];
    },
    async updateOffer(id: number, payload: Record<string, string>) {
      const allowedFields = ["priorytet", "status_aplikacji", "status_ogloszenia", "notatki"];
      const entries = Object.entries(payload).filter(([key]) => allowedFields.includes(key));

      if (entries.length === 0) {
        return { ok: false };
      }

      const setSql = entries.map(([key]) => `${key} = ?`).join(", ");
      const params = entries.map(([, value]) => value);

      sqlite
        .prepare(`UPDATE job_offers SET ${setSql}, updated_at = ? WHERE id = ?`)
        .run(...params, new Date().toISOString(), id);

      return { ok: true };
    },
    async createImportJob(kind: string) {
      const createdAt = new Date().toISOString();
      const inserted = sqlite
        .prepare(
          `
            INSERT INTO import_jobs (
              kind, status, requested_by, payload, created_at, started_at
            ) VALUES (?, 'running', 'user', '{}', ?, ?)
          `
        )
        .run(kind, createdAt, createdAt);

      const jobId = Number(inserted.lastInsertRowid);

      try {
        const offers = await searchJobsViaMcp({
          phrase: config.importPhrase,
          sortOrder: "newest",
          minSalary: null
        });

        const result = await runImport({
          offers,
          profile: {
            knownStack: config.knownStack,
            profileKeywords: config.profileKeywords,
            allowedCities: config.allowedCities
          },
          hasUrl: async (url) => {
            const row = sqlite
              .prepare(`SELECT 1 as found FROM job_offers WHERE url = ? LIMIT 1`)
              .get(url) as { found: number } | undefined;

            return Boolean(row?.found);
          },
          saveOffer: async (offer) => {
            sqlite
              .prepare(
                `
                  INSERT INTO job_offers (
                    stanowisko, firma, url, widełki_od, widełki_do, lokalizacja, tryb_pracy,
                    kontrakt, status_ogloszenia, status_aplikacji, priorytet, notatki,
                    data_dodania, ostatnia_weryfikacja, source, source_external_id,
                    created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
              )
              .run(
                offer.title,
                offer.company,
                offer.url,
                offer.salaryFrom ?? null,
                offer.salaryTo ?? null,
                offer.location,
                offer.workMode,
                offer.contract,
                "🟢 Aktywne",
                "📋 Zapisana",
                offer.priority,
                offer.generatedNotes.join(", "),
                new Date().toISOString().slice(0, 10),
                null,
                "czyjesteldorado_mcp",
                null,
                new Date().toISOString(),
                new Date().toISOString()
              );
          }
        });

        sqlite
          .prepare(
            `
              UPDATE import_jobs
              SET status = 'succeeded',
                  stats_fetched = ?,
                  stats_added = ?,
                  stats_rejected = ?,
                  stats_duplicates = ?,
                  finished_at = ?
              WHERE id = ?
            `
          )
          .run(
            result.fetched,
            result.added,
            result.rejected,
            result.duplicates,
            new Date().toISOString(),
            jobId
          );

        return {
          id: jobId,
          kind,
          ...result
        };
      } catch (error) {
        sqlite
          .prepare(
            `
              UPDATE import_jobs
              SET status = 'failed',
                  error_message = ?,
                  finished_at = ?
              WHERE id = ?
            `
          )
          .run(
            error instanceof Error ? error.message : "Unknown import error",
            new Date().toISOString(),
            jobId
          );

        throw error;
      }
    }
  };
}
