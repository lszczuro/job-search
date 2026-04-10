import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { searchJobsViaMcp } from "../adapters/czyjesteldorado/mcp-client";
import { parseEnv } from "../config/env";
import { runImport } from "../core/importing/run-import";
import { createImportJobsRepository } from "../db/repositories/import-jobs-repository";
import type { OfferListItem } from "../web/offer-view-model";

function getNftyMessage(added: number) {
  return added === 1 ? "Znaleziono 1 nową ofertę" : `Znaleziono ${added} nowe oferty`;
}

async function publishNftyNotification(
  config: {
    endpoint: string | null;
    login: string | null;
    password: string | null;
    clickUrl: string | null;
  },
  added: number
) {
  if (!config.endpoint || !config.login || !config.password || added <= 0) {
    return;
  }

  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${config.login}:${config.password}`).toString("base64")}`
  };

  if (config.clickUrl) {
    headers.Click = config.clickUrl;
  }

  await fetch(config.endpoint, {
    method: "POST",
    body: getNftyMessage(added),
    headers
  });
}

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
  const importJobs = createImportJobsRepository(sqlite);

  return {
    refreshCron: config.refreshCron,
    timezone: config.timezone,
    async publishNftyNotification(added: number) {
      await publishNftyNotification(config.nfty, added);
    },
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
        return { ok: false, error: "NO_EDITABLE_FIELDS" };
      }

      const setSql = entries.map(([key]) => `${key} = ?`).join(", ");
      const params = entries.map(([, value]) => value);

      const result = sqlite
        .prepare(`UPDATE job_offers SET ${setSql}, updated_at = ? WHERE id = ?`)
        .run(...params, new Date().toISOString(), id);

      if (result.changes === 0) {
        return { ok: false, error: "OFFER_NOT_FOUND" };
      }

      return { ok: true };
    },
    async createOrReuseRefreshJob(kind: "manual_refresh" | "scheduled_refresh") {
      return importJobs.createOrReuseRefreshJob(kind, kind === "manual_refresh" ? "user" : "system");
    },
    async getLatestSuccessfulRefresh() {
      return importJobs.getLatestSuccessfulRefresh();
    },
    async fetchPendingJob() {
      return importJobs.fetchPendingJob();
    },
    async markJobRunning(id: number) {
      return importJobs.markJobRunning(id);
    },
    async markJobSucceeded(
      id: number,
      result: { fetched: number; added: number; rejected: number; duplicates: number; errors: number }
    ) {
      return importJobs.markJobSucceeded(id, result);
    },
    async markJobFailed(id: number, errorMessage: string) {
      return importJobs.markJobFailed(id, errorMessage);
    },
    async runRefreshJob() {
      const offers = await searchJobsViaMcp({
        phrase: config.importPhrase,
        sortOrder: "newest",
        minSalary: null
      });

      return runImport({
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
    }
  };
}
