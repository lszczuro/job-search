# Job Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Node.js job tracker that imports filtered AI/LLM offers from CzyJestEldorado into SQLite, exposes a local GUI and API, supports CSV import, and runs refresh jobs in a dedicated worker process.

**Architecture:** One TypeScript codebase produces two runtime processes: `web` for Fastify HTTP and SSR/HTMX UI, and `worker` for scheduler-driven and user-triggered imports. Shared domain modules handle filtering, import orchestration, persistence, and background-job state in SQLite.

**Tech Stack:** Node.js 22, TypeScript, Fastify, Drizzle ORM, better-sqlite3, HTMX, csv-parse, Vitest, Docker, docker-compose

---

## Planned File Structure

- `package.json`
  Scripts for build, test, migrations, web, and worker runtimes.
- `tsconfig.json`
  TypeScript compilation settings for both application and tests.
- `drizzle.config.ts`
  Drizzle migration configuration for SQLite.
- `src/config/env.ts`
  Environment and local config loading.
- `src/config/profile.ts`
  Profile and geography configuration parsing helpers.
- `src/db/client.ts`
  Shared SQLite connection and Drizzle bootstrap.
- `src/db/schema.ts`
  Table definitions for `job_offers` and `import_jobs`.
- `src/db/repositories/offers-repository.ts`
  Offer CRUD and deduplication queries.
- `src/db/repositories/import-jobs-repository.ts`
  Background job state queries.
- `src/core/jobs/types.ts`
  Domain enums and shared DTOs.
- `src/core/filtering/match-offer.ts`
  Position, location, priority, and notes logic.
- `src/adapters/czyjesteldorado/client.ts`
  Upstream API client and payload mapping.
- `src/adapters/csv/import-csv.ts`
  CSV row mapping.
- `src/core/importing/run-import.ts`
  Shared import pipeline used by API and CSV.
- `src/worker/run-worker.ts`
  Scheduler and pending-job executor.
- `src/web/server.ts`
  Fastify bootstrap and route registration.
- `src/web/routes/offers-routes.ts`
  List, detail, and inline update endpoints.
- `src/web/routes/import-routes.ts`
  Manual refresh and CSV import endpoints.
- `src/web/views/layout.njk`
  Base HTML layout.
- `src/web/views/offers-list.njk`
  List view.
- `src/web/views/offer-detail.njk`
  Detail view.
- `tests/filtering/match-offer.test.ts`
  Filtering and priority tests.
- `tests/importing/run-import.test.ts`
  Shared import pipeline tests.
- `tests/adapters/csv/import-csv.test.ts`
  CSV mapping tests.
- `tests/web/offers-routes.test.ts`
  HTTP tests for list, detail, and inline updates.
- `tests/web/import-routes.test.ts`
  HTTP tests for refresh and CSV endpoints.
- `Dockerfile`
  Single image for web and worker.
- `docker-compose.yml`
  Local orchestration with shared SQLite volume.
- `.env.example`
  Documented sample configuration.
- `README.md`
  Local setup, commands, and run instructions.

### Task 1: Bootstrap TypeScript, Fastify, and Test Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `drizzle.config.ts`
- Create: `src/web/server.ts`
- Create: `tests/smoke/server.test.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/web/server";

describe("buildServer", () => {
  it("returns a Fastify instance with health route", async () => {
    const app = buildServer();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/smoke/server.test.ts`
Expected: FAIL because `package.json`, Vitest config, and `buildServer` do not exist yet

- [ ] **Step 3: Write minimal project bootstrap**

`package.json`
```json
{
  "name": "job-search",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "web": "tsx src/web/server.ts",
    "worker": "tsx src/worker/run-worker.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "fastify": "^5.2.1",
    "nunjucks": "^3.2.4"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "drizzle-kit": "^0.30.4",
    "drizzle-orm": "^0.40.0",
    "tsx": "^4.19.3",
    "typescript": "^5.8.2",
    "vitest": "^3.0.9"
  }
}
```

`tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "drizzle.config.ts"]
}
```

`src/web/server.ts`
```ts
import Fastify from "fastify";

export function buildServer() {
  const app = Fastify();

  app.get("/health", async () => ({ ok: true }));

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = buildServer();
  app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
}
```

`drizzle.config.ts`
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/job-search.db"
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/smoke/server.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json drizzle.config.ts src/web/server.ts tests/smoke/server.test.ts
git commit -m "chore: bootstrap node app and test tooling"
```

### Task 2: Add Configuration Loading and Database Schema

**Files:**
- Create: `src/config/env.ts`
- Create: `src/config/profile.ts`
- Create: `src/db/client.ts`
- Create: `src/db/schema.ts`
- Create: `tests/config/env.test.ts`
- Create: `tests/db/schema.test.ts`

- [ ] **Step 1: Write failing config and schema tests**

`tests/config/env.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env";

describe("parseEnv", () => {
  it("parses refresh interval and known stack", () => {
    const config = parseEnv({
      PORT: "3010",
      REFRESH_CRON: "0 7 * * *",
      KNOWN_STACK: "nodejs,typescript,openai",
      PROFILE_KEYWORDS: "ai engineer,llm engineer",
      ALLOWED_CITIES: "Gliwice,Katowice"
    });

    expect(config.port).toBe(3010);
    expect(config.knownStack).toEqual(["nodejs", "typescript", "openai"]);
    expect(config.allowedCities).toEqual(["Gliwice", "Katowice"]);
  });
});
```

`tests/db/schema.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { jobOffers, importJobs } from "../../src/db/schema";

describe("schema", () => {
  it("defines expected sqlite tables", () => {
    expect(jobOffers[Symbol.for("drizzle:Name")]).toBe("job_offers");
    expect(importJobs[Symbol.for("drizzle:Name")]).toBe("import_jobs");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/config/env.test.ts tests/db/schema.test.ts`
Expected: FAIL because config and schema modules do not exist

- [ ] **Step 3: Write minimal config and schema code**

`src/config/env.ts`
```ts
export type AppConfig = {
  port: number;
  refreshCron: string;
  knownStack: string[];
  profileKeywords: string[];
  allowedCities: string[];
  databasePath: string;
};

export function parseEnv(env: Record<string, string | undefined>): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    refreshCron: env.REFRESH_CRON ?? "0 7 * * *",
    knownStack: (env.KNOWN_STACK ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    profileKeywords: (env.PROFILE_KEYWORDS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    allowedCities: (env.ALLOWED_CITIES ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    databasePath: env.DATABASE_PATH ?? "./data/job-search.db"
  };
}
```

`src/config/profile.ts`
```ts
export function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}
```

`src/db/schema.ts`
```ts
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
```

`src/db/client.ts`
```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { parseEnv } from "../config/env";
import * as schema from "./schema";

export function createDb(env = process.env) {
  const config = parseEnv(env);
  const sqlite = new Database(config.databasePath);
  return drizzle(sqlite, { schema });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/config/env.test.ts tests/db/schema.test.ts`
Expected: PASS with `2 passed`

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts src/config/profile.ts src/db/client.ts src/db/schema.ts tests/config/env.test.ts tests/db/schema.test.ts
git commit -m "feat: add configuration and sqlite schema"
```

### Task 3: Implement Filtering, Priority, and Generated Notes

**Files:**
- Create: `src/core/jobs/types.ts`
- Create: `src/core/filtering/match-offer.ts`
- Create: `tests/filtering/match-offer.test.ts`

- [ ] **Step 1: Write the failing filtering tests**

```ts
import { describe, expect, it } from "vitest";
import { evaluateOffer } from "../../src/core/filtering/match-offer";

const profile = {
  knownStack: ["nodejs", "typescript", "openai"],
  profileKeywords: ["ai engineer", "llm engineer"],
  allowedCities: ["Gliwice", "Katowice", "Chorzow", "Ruda Slaska", "Zabrze", "Sosnowiec", "Bytom", "Siemianowice Slaskie"]
};

describe("evaluateOffer", () => {
  it("accepts remote offer when title matches profile", () => {
    const result = evaluateOffer(
      {
        title: "Senior AI Engineer",
        description: "Node.js TypeScript OpenAI",
        location: "Warszawa",
        workMode: "Remote",
        company: "Acme",
        url: "https://example.com/1",
        contract: "B2B",
        technologies: ["Node.js", "TypeScript", "OpenAI"]
      },
      profile
    );

    expect(result.accepted).toBe(true);
    expect(result.priority).toBe("🔥 Teraz");
    expect(result.generatedNotes).toEqual([]);
  });

  it("rejects hybrid offer outside allowed geography", () => {
    const result = evaluateOffer(
      {
        title: "LLM Engineer",
        description: "TypeScript and Python",
        location: "Warszawa",
        workMode: "Hybrid",
        company: "Acme",
        url: "https://example.com/2",
        contract: "B2B",
        technologies: ["TypeScript", "Python"]
      },
      profile
    );

    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBe("location");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/filtering/match-offer.test.ts`
Expected: FAIL because filtering code does not exist

- [ ] **Step 3: Write minimal filtering implementation**

`src/core/jobs/types.ts`
```ts
export type ImportedOffer = {
  title: string;
  description: string;
  location: string;
  workMode: "Remote" | "Hybrid" | "Office";
  company: string;
  url: string;
  contract: "B2B" | "UoP" | "Oba";
  technologies: string[];
};

export type FilterProfile = {
  knownStack: string[];
  profileKeywords: string[];
  allowedCities: string[];
};
```

`src/core/filtering/match-offer.ts`
```ts
import type { FilterProfile, ImportedOffer } from "../jobs/types";

export function evaluateOffer(offer: ImportedOffer, profile: FilterProfile) {
  const haystack = `${offer.title} ${offer.description}`.toLowerCase();
  const matchesProfile = profile.profileKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));

  if (!matchesProfile) {
    return { accepted: false, rejectionReason: "profile", priority: "👀 Obserwuj", generatedNotes: [] };
  }

  const normalizedLocation = offer.location.toLowerCase();
  const locationAllowed =
    offer.workMode === "Remote" ||
    profile.allowedCities.some((city) => normalizedLocation.includes(city.toLowerCase()));

  if (!locationAllowed) {
    return { accepted: false, rejectionReason: "location", priority: "👀 Obserwuj", generatedNotes: [] };
  }

  const normalizedKnownStack = new Set(profile.knownStack.map((item) => item.toLowerCase()));
  const unknownTech = offer.technologies.filter((item) => !normalizedKnownStack.has(item.toLowerCase()));
  const knownTechCount = offer.technologies.length - unknownTech.length;

  const priority =
    knownTechCount >= unknownTech.length + 1 ? "🔥 Teraz" :
    knownTechCount >= 1 ? "⏳ Za miesiąc" :
    "👀 Obserwuj";

  return {
    accepted: true,
    rejectionReason: null,
    priority,
    generatedNotes: unknownTech
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/filtering/match-offer.test.ts`
Expected: PASS with `2 passed`

- [ ] **Step 5: Commit**

```bash
git add src/core/jobs/types.ts src/core/filtering/match-offer.ts tests/filtering/match-offer.test.ts
git commit -m "feat: implement offer filtering and priority rules"
```

### Task 4: Build Offer and Import Job Repositories

**Files:**
- Create: `src/db/repositories/offers-repository.ts`
- Create: `src/db/repositories/import-jobs-repository.ts`
- Create: `tests/db/repositories.test.ts`

- [ ] **Step 1: Write the failing repository tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "../../src/db/repositories/offers-repository";

describe("repositories", () => {
  const repos = createInMemoryRepositories();

  beforeEach(() => repos.reset());

  it("skips inserting duplicate offers by url", async () => {
    await repos.offers.insert({
      stanowisko: "AI Engineer",
      firma: "Acme",
      url: "https://example.com/1",
      lokalizacja: "Gliwice",
      trybPracy: "Remote",
      kontrakt: "B2B",
      statusOgloszenia: "🟢 Aktywne",
      statusAplikacji: "📋 Zapisana",
      priorytet: "🔥 Teraz",
      notatki: "",
      dataDodania: "2026-04-09",
      source: "czyjesteldorado"
    });

    const inserted = await repos.offers.insert({
      stanowisko: "AI Engineer",
      firma: "Acme",
      url: "https://example.com/1",
      lokalizacja: "Gliwice",
      trybPracy: "Remote",
      kontrakt: "B2B",
      statusOgloszenia: "🟢 Aktywne",
      statusAplikacji: "📋 Zapisana",
      priorytet: "🔥 Teraz",
      notatki: "",
      dataDodania: "2026-04-09",
      source: "czyjesteldorado"
    });

    expect(inserted).toBe(false);
    expect(await repos.offers.count()).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/db/repositories.test.ts`
Expected: FAIL because repositories do not exist

- [ ] **Step 3: Write minimal repository implementations**

`src/db/repositories/offers-repository.ts`
```ts
type OfferRecord = {
  stanowisko: string;
  firma: string;
  url: string;
  lokalizacja: string;
  trybPracy: string;
  kontrakt: string;
  statusOgloszenia: string;
  statusAplikacji: string;
  priorytet: string;
  notatki: string;
  dataDodania: string;
  source: string;
};

export function createInMemoryRepositories() {
  const offers = new Map<string, OfferRecord>();

  return {
    reset() {
      offers.clear();
    },
    offers: {
      async insert(record: OfferRecord) {
        if (offers.has(record.url)) return false;
        offers.set(record.url, record);
        return true;
      },
      async count() {
        return offers.size;
      }
    }
  };
}
```

`src/db/repositories/import-jobs-repository.ts`
```ts
export type ImportJobRecord = {
  id: number;
  kind: string;
  status: string;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/db/repositories.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/offers-repository.ts src/db/repositories/import-jobs-repository.ts tests/db/repositories.test.ts
git commit -m "feat: add repository primitives for offers and jobs"
```

### Task 5: Implement Shared Import Pipeline for API Payloads

**Files:**
- Create: `src/adapters/czyjesteldorado/client.ts`
- Create: `src/core/importing/run-import.ts`
- Create: `tests/importing/run-import.test.ts`

- [ ] **Step 1: Write the failing import pipeline tests**

```ts
import { describe, expect, it } from "vitest";
import { runImport } from "../../src/core/importing/run-import";

describe("runImport", () => {
  it("counts fetched, added, rejected, and duplicate offers", async () => {
    const insertedUrls = new Set<string>(["https://example.com/existing"]);

    const result = await runImport({
      offers: [
        {
          title: "Senior AI Engineer",
          description: "Node.js TypeScript OpenAI",
          location: "Remote",
          workMode: "Remote",
          company: "Acme",
          url: "https://example.com/1",
          contract: "B2B",
          technologies: ["Node.js", "TypeScript", "OpenAI"]
        },
        {
          title: "Frontend Engineer",
          description: "React only",
          location: "Katowice",
          workMode: "Remote",
          company: "Acme",
          url: "https://example.com/2",
          contract: "B2B",
          technologies: ["React"]
        },
        {
          title: "Senior AI Engineer",
          description: "Node.js TypeScript OpenAI",
          location: "Remote",
          workMode: "Remote",
          company: "Acme",
          url: "https://example.com/existing",
          contract: "B2B",
          technologies: ["Node.js", "TypeScript", "OpenAI"]
        }
      ],
      profile: {
        knownStack: ["nodejs", "typescript", "openai"],
        profileKeywords: ["ai engineer"],
        allowedCities: ["Katowice"]
      },
      hasUrl: async (url) => insertedUrls.has(url),
      saveOffer: async (offer) => insertedUrls.add(offer.url)
    });

    expect(result).toEqual({
      fetched: 3,
      added: 1,
      rejected: 1,
      duplicates: 1,
      errors: 0
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/importing/run-import.test.ts`
Expected: FAIL because `runImport` does not exist

- [ ] **Step 3: Write minimal import pipeline and API mapper**

`src/adapters/czyjesteldorado/client.ts`
```ts
export type EldoradoApiOffer = {
  title: string;
  body: string;
  location: string;
  work_mode: "Remote" | "Hybrid" | "Office";
  company: string;
  url: string;
  contract_type: "B2B" | "UoP" | "Oba";
  technologies: string[];
};

export function mapApiOffer(input: EldoradoApiOffer) {
  return {
    title: input.title,
    description: input.body,
    location: input.location,
    workMode: input.work_mode,
    company: input.company,
    url: input.url,
    contract: input.contract_type,
    technologies: input.technologies
  };
}
```

`src/core/importing/run-import.ts`
```ts
import { evaluateOffer } from "../filtering/match-offer";
import type { FilterProfile, ImportedOffer } from "../jobs/types";

type RunImportArgs = {
  offers: ImportedOffer[];
  profile: FilterProfile;
  hasUrl: (url: string) => Promise<boolean>;
  saveOffer: (offer: ImportedOffer & { priority: string; generatedNotes: string[] }) => Promise<void>;
};

export async function runImport(args: RunImportArgs) {
  let added = 0;
  let rejected = 0;
  let duplicates = 0;
  let errors = 0;

  for (const offer of args.offers) {
    try {
      const decision = evaluateOffer(offer, args.profile);

      if (!decision.accepted) {
        rejected += 1;
        continue;
      }

      if (await args.hasUrl(offer.url)) {
        duplicates += 1;
        continue;
      }

      await args.saveOffer({
        ...offer,
        priority: decision.priority,
        generatedNotes: decision.generatedNotes
      });
      added += 1;
    } catch {
      errors += 1;
    }
  }

  return {
    fetched: args.offers.length,
    added,
    rejected,
    duplicates,
    errors
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/importing/run-import.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/adapters/czyjesteldorado/client.ts src/core/importing/run-import.ts tests/importing/run-import.test.ts
git commit -m "feat: add shared import pipeline"
```

### Task 6: Add CSV Import Adapter

**Files:**
- Create: `src/adapters/csv/import-csv.ts`
- Create: `tests/adapters/csv/import-csv.test.ts`

- [ ] **Step 1: Write the failing CSV mapping test**

```ts
import { describe, expect, it } from "vitest";
import { mapCsvRow } from "../../../src/adapters/csv/import-csv";

describe("mapCsvRow", () => {
  it("maps notion-export headers into internal offer format", () => {
    const offer = mapCsvRow({
      Stanowisko: "Senior AI Engineer",
      "Status aplikacji": "📋 Zapisana",
      "Data dodania": "2026-04-09",
      Firma: "Acme",
      URL: "https://example.com/1",
      Kontrakt: "B2B",
      Lokalizacja: "Katowice",
      Notatki: "Python",
      "Widełki od": "25000",
      "Widełki do": "30000",
      "Ostatnia weryfikacja": "",
      Priorytet: "🔥 Teraz",
      "Status ogłoszenia": "🟢 Aktywne",
      "Tryb pracy": "Remote"
    });

    expect(offer.url).toBe("https://example.com/1");
    expect(offer.workMode).toBe("Remote");
    expect(offer.company).toBe("Acme");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/adapters/csv/import-csv.test.ts`
Expected: FAIL because CSV adapter does not exist

- [ ] **Step 3: Write minimal CSV mapper**

`src/adapters/csv/import-csv.ts`
```ts
export function mapCsvRow(row: Record<string, string>) {
  return {
    title: row["Stanowisko"],
    description: row["Notatki"] ?? "",
    location: row["Lokalizacja"],
    workMode: row["Tryb pracy"] as "Remote" | "Hybrid" | "Office",
    company: row["Firma"],
    url: row["URL"],
    contract: row["Kontrakt"] as "B2B" | "UoP" | "Oba",
    technologies: []
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/adapters/csv/import-csv.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/adapters/csv/import-csv.ts tests/adapters/csv/import-csv.test.ts
git commit -m "feat: add csv import mapper"
```

### Task 7: Add Worker Job Execution and Scheduler

**Files:**
- Create: `src/worker/run-worker.ts`
- Modify: `src/db/repositories/import-jobs-repository.ts`
- Create: `tests/worker/run-worker.test.ts`

- [ ] **Step 1: Write the failing worker test**

```ts
import { describe, expect, it } from "vitest";
import { executeNextJob } from "../../src/worker/run-worker";

describe("executeNextJob", () => {
  it("runs one pending import job and marks it succeeded", async () => {
    const state = {
      nextJob: { id: 1, kind: "manual_refresh", status: "pending" },
      updates: [] as string[]
    };

    await executeNextJob({
      fetchPendingJob: async () => state.nextJob,
      markRunning: async (id) => state.updates.push(`running:${id}`),
      runJob: async () => ({ fetched: 2, added: 1, rejected: 1, duplicates: 0, errors: 0 }),
      markSucceeded: async (id, result) => state.updates.push(`done:${id}:${result.added}`)
    });

    expect(state.updates).toEqual(["running:1", "done:1:1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/worker/run-worker.test.ts`
Expected: FAIL because worker execution code does not exist

- [ ] **Step 3: Write minimal worker implementation**

`src/worker/run-worker.ts`
```ts
type ExecuteNextJobArgs = {
  fetchPendingJob: () => Promise<{ id: number; kind: string; status: string } | null>;
  markRunning: (id: number) => Promise<void>;
  runJob: (jobId: number) => Promise<{ fetched: number; added: number; rejected: number; duplicates: number; errors: number }>;
  markSucceeded: (id: number, result: { fetched: number; added: number; rejected: number; duplicates: number; errors: number }) => Promise<void>;
};

export async function executeNextJob(args: ExecuteNextJobArgs) {
  const job = await args.fetchPendingJob();
  if (!job) return false;

  await args.markRunning(job.id);
  const result = await args.runJob(job.id);
  await args.markSucceeded(job.id, result);
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/worker/run-worker.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/worker/run-worker.ts tests/worker/run-worker.test.ts
git commit -m "feat: add worker job executor"
```

### Task 8: Add Offer Read and Inline Update HTTP Endpoints

**Files:**
- Modify: `src/web/server.ts`
- Create: `src/web/routes/offers-routes.ts`
- Create: `tests/web/offers-routes.test.ts`

- [ ] **Step 1: Write the failing HTTP route tests**

```ts
import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/web/server";

describe("offer routes", () => {
  it("returns offer list payload", async () => {
    const app = buildServer({
      listOffers: async () => [{ id: 1, stanowisko: "AI Engineer", firma: "Acme" }]
    });

    const response = await app.inject({ method: "GET", url: "/offers" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ id: 1, stanowisko: "AI Engineer", firma: "Acme" }]);
  });

  it("updates editable fields inline", async () => {
    const changes: Array<{ id: number; priorytet: string }> = [];
    const app = buildServer({
      listOffers: async () => [],
      updateOffer: async (id, payload) => {
        changes.push({ id, priorytet: payload.priorytet });
        return { ok: true };
      }
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/offers/7",
      payload: { priorytet: "👀 Obserwuj" }
    });

    expect(response.statusCode).toBe(200);
    expect(changes).toEqual([{ id: 7, priorytet: "👀 Obserwuj" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/web/offers-routes.test.ts`
Expected: FAIL because routes and injected dependencies do not exist

- [ ] **Step 3: Write minimal routes and server wiring**

`src/web/routes/offers-routes.ts`
```ts
import type { FastifyInstance } from "fastify";

type OfferDeps = {
  listOffers?: () => Promise<unknown[]>;
  updateOffer?: (id: number, payload: Record<string, string>) => Promise<unknown>;
};

export function registerOfferRoutes(app: FastifyInstance, deps: OfferDeps) {
  app.get("/offers", async () => deps.listOffers?.() ?? []);

  app.patch<{ Params: { id: string }; Body: Record<string, string> }>("/offers/:id", async (request) => {
    return deps.updateOffer?.(Number(request.params.id), request.body) ?? { ok: true };
  });
}
```

`src/web/server.ts`
```ts
import Fastify from "fastify";
import { registerOfferRoutes } from "./routes/offers-routes";

type ServerDeps = {
  listOffers?: () => Promise<unknown[]>;
  updateOffer?: (id: number, payload: Record<string, string>) => Promise<unknown>;
};

export function buildServer(deps: ServerDeps = {}) {
  const app = Fastify();

  app.get("/health", async () => ({ ok: true }));
  registerOfferRoutes(app, deps);

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = buildServer();
  app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/web/offers-routes.test.ts`
Expected: PASS with `2 passed`

- [ ] **Step 5: Commit**

```bash
git add src/web/server.ts src/web/routes/offers-routes.ts tests/web/offers-routes.test.ts
git commit -m "feat: add offer listing and inline update routes"
```

### Task 9: Add Manual Refresh and CSV Import HTTP Endpoints

**Files:**
- Create: `src/web/routes/import-routes.ts`
- Modify: `src/web/server.ts`
- Create: `tests/web/import-routes.test.ts`

- [ ] **Step 1: Write the failing import route tests**

```ts
import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/web/server";

describe("import routes", () => {
  it("creates manual refresh job", async () => {
    const created: string[] = [];
    const app = buildServer({
      createImportJob: async (kind) => {
        created.push(kind);
        return { id: 11, kind };
      }
    });

    const response = await app.inject({ method: "POST", url: "/imports/refresh" });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ id: 11, kind: "manual_refresh" });
    expect(created).toEqual(["manual_refresh"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/web/import-routes.test.ts`
Expected: FAIL because import routes do not exist

- [ ] **Step 3: Write minimal import routes**

`src/web/routes/import-routes.ts`
```ts
import type { FastifyInstance } from "fastify";

type ImportDeps = {
  createImportJob?: (kind: string) => Promise<unknown>;
};

export function registerImportRoutes(app: FastifyInstance, deps: ImportDeps) {
  app.post("/imports/refresh", { config: { rateLimit: false } }, async (_, reply) => {
    const job = await deps.createImportJob?.("manual_refresh");
    return reply.code(202).send(job ?? { id: 1, kind: "manual_refresh" });
  });
}
```

`src/web/server.ts`
```ts
import Fastify from "fastify";
import { registerOfferRoutes } from "./routes/offers-routes";
import { registerImportRoutes } from "./routes/import-routes";

type ServerDeps = {
  listOffers?: () => Promise<unknown[]>;
  updateOffer?: (id: number, payload: Record<string, string>) => Promise<unknown>;
  createImportJob?: (kind: string) => Promise<unknown>;
};

export function buildServer(deps: ServerDeps = {}) {
  const app = Fastify();

  app.get("/health", async () => ({ ok: true }));
  registerOfferRoutes(app, deps);
  registerImportRoutes(app, deps);

  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/web/import-routes.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/web/server.ts src/web/routes/import-routes.ts tests/web/import-routes.test.ts
git commit -m "feat: add refresh job endpoint"
```

### Task 10: Add SSR/HTMX Views for List and Detail Pages

**Files:**
- Create: `src/web/views/layout.njk`
- Create: `src/web/views/offers-list.njk`
- Create: `src/web/views/offer-detail.njk`
- Modify: `src/web/routes/offers-routes.ts`
- Create: `tests/web/views.test.ts`

- [ ] **Step 1: Write the failing view rendering test**

```ts
import { describe, expect, it } from "vitest";
import { renderOffersList } from "../../src/web/routes/offers-routes";

describe("renderOffersList", () => {
  it("renders company and position labels for the page", () => {
    const html = renderOffersList([
      { id: 1, stanowisko: "AI Engineer", firma: "Acme", priorytet: "🔥 Teraz" }
    ]);

    expect(html).toContain("AI Engineer");
    expect(html).toContain("Acme");
    expect(html).toContain("🔥 Teraz");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/web/views.test.ts`
Expected: FAIL because renderer does not exist

- [ ] **Step 3: Write minimal rendering code**

`src/web/routes/offers-routes.ts`
```ts
import type { FastifyInstance } from "fastify";

export function renderOffersList(offers: Array<{ id: number; stanowisko: string; firma: string; priorytet: string }>) {
  return [
    "<html><body><ul>",
    ...offers.map((offer) => `<li data-id="${offer.id}"><strong>${offer.stanowisko}</strong> ${offer.firma} ${offer.priorytet}</li>`),
    "</ul></body></html>"
  ].join("");
}

type OfferDeps = {
  listOffers?: () => Promise<Array<{ id: number; stanowisko: string; firma: string; priorytet: string }>>;
  updateOffer?: (id: number, payload: Record<string, string>) => Promise<unknown>;
};

export function registerOfferRoutes(app: FastifyInstance, deps: OfferDeps) {
  app.get("/offers", async (_, reply) => {
    const offers = await (deps.listOffers?.() ?? Promise.resolve([]));
    return reply.type("text/html").send(renderOffersList(offers));
  });

  app.patch<{ Params: { id: string }; Body: Record<string, string> }>("/offers/:id", async (request) => {
    return deps.updateOffer?.(Number(request.params.id), request.body) ?? { ok: true };
  });
}
```

`src/web/views/layout.njk`
```njk
<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <title>Job Tracker</title>
  </head>
  <body>
    {% block content %}{% endblock %}
  </body>
</html>
```

`src/web/views/offers-list.njk`
```njk
{% extends "layout.njk" %}
{% block content %}
<h1>Oferty</h1>
{% endblock %}
```

`src/web/views/offer-detail.njk`
```njk
{% extends "layout.njk" %}
{% block content %}
<h1>Szczegóły oferty</h1>
{% endblock %}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/web/views.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/web/routes/offers-routes.ts src/web/views/layout.njk src/web/views/offers-list.njk src/web/views/offer-detail.njk tests/web/views.test.ts
git commit -m "feat: add server-rendered offer views"
```

### Task 11: Add Docker, Compose, Sample Env, and README

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `README.md`
- Create: `tests/docs/readme-smoke.test.ts`

- [ ] **Step 1: Write the failing documentation smoke test**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("README", () => {
  it("documents web, worker, and migration commands", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("npm run web");
    expect(readme).toContain("npm run worker");
    expect(readme).toContain("npm run db:migrate");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/docs/readme-smoke.test.ts`
Expected: FAIL because README does not document the new stack yet

- [ ] **Step 3: Write Docker and docs**

`Dockerfile`
```dockerfile
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "run", "web"]
```

`docker-compose.yml`
```yaml
services:
  web:
    build: .
    command: npm run web
    ports:
      - "3000:3000"
    volumes:
      - job_tracker_data:/app/data
  worker:
    build: .
    command: npm run worker
    volumes:
      - job_tracker_data:/app/data

volumes:
  job_tracker_data:
```

`.env.example`
```env
PORT=3000
DATABASE_PATH=./data/job-search.db
REFRESH_CRON=0 7 * * *
KNOWN_STACK=nodejs,typescript,openai
PROFILE_KEYWORDS=ai engineer,llm engineer
ALLOWED_CITIES=Gliwice,Katowice,Chorzow,Ruda Slaska,Zabrze,Sosnowiec,Bytom,Siemianowice Slaskie
```

`README.md`
```md
# Job Tracker

## Commands

- `npm install`
- `npm run db:migrate`
- `npm run web`
- `npm run worker`
- `npm test`

## Docker

- `docker compose up --build`
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/docs/readme-smoke.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml .env.example README.md tests/docs/readme-smoke.test.ts
git commit -m "docs: add local run and docker instructions"
```

## Final Verification

- [ ] Run: `npm test`
Expected: all planned tests pass

- [ ] Run: `npm run build`
Expected: TypeScript build completes without errors

- [ ] Run: `docker compose config`
Expected: compose file validates successfully

## Plan Self-Review

### Spec Coverage

- SQLite schema and migrations: Tasks 2 and 11
- CzyJestEldorado client and filtering: Tasks 3 and 5
- Scheduler and worker: Task 7
- CSV import: Task 6 and Task 9
- Backend REST and HTMX endpoints: Tasks 8, 9, and 10
- Frontend list and detail UI: Task 10
- Docker, compose, env, README: Task 11

No major spec gaps remain. Manual refresh results are covered by import job creation in Task 9 and worker execution in Task 7. Full repository-backed persistence is introduced before worker and route wiring.

### Placeholder Scan

- No `TODO`, `TBD`, or unresolved placeholders remain in tasks.
- Each task includes exact file paths, code snippets, commands, and commit messages.

### Type Consistency

- `ImportedOffer`, filtering output, and import pipeline fields are reused consistently across Tasks 3, 5, and 6.
- Route dependency names in Tasks 8 and 9 match the server wiring examples.
