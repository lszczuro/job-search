# Architecture

## System Map

`job-search` jest lokalną aplikacją monolityczną z jednym repo i dwoma runtime'ami Node.js.

```text
[ Browser ]
    |
    v
[ Fastify web ]
    |  \
    |   \-- serves HTML shell + React/TanStack bundle
    |
    +-- GET /offers
    +-- PATCH /offers/:id
    +-- POST /imports/refresh
    |
    v
[ SQLite ]
    ^
    |
[ Worker runtime ]
[ Worker runtime ] -- fetch --> [ public MCP: https://czyjesteldorado.pl/_mcp ]
```

## Runtime Components

### Web

Plik wejściowy: `src/web/server.ts`

Odpowiedzialności:

- start Fastify
- rejestracja endpointów HTTP
- serwowanie `/health`
- serwowanie bundla `/assets/offers-app.js`
- render strony głównej `/`
- enqueue manual refresh przez `POST /imports/refresh`

### Client UI

Plik wejściowy: `src/web/client/offers-app.tsx`

Odpowiedzialności:

- odczyt zserializowanych ofert z HTML
- odczyt metadanych ostatniego refreshu z HTML
- render tabeli na React 19
- obsługa przycisku ręcznego refreshu
- formatowanie dat w skonfigurowanym timezone
- konfiguracja TanStack Table
- sortowanie
- filtrowanie po labelkach
- przełączanie widoczności kolumn

### Runtime / Persistence

Plik wejściowy: `src/app/runtime.ts`

Odpowiedzialności:

- parsowanie konfiguracji środowiskowej
- otwarcie SQLite
- bootstrap schematu przy starcie
- odczyt listy ofert
- aktualizacja wybranych pól oferty
- enqueue refresh jobów
- odczyt statusu ostatniego udanego refreshu
- wykonanie właściwego importu dla workera

### Import Adapter

Plik wejściowy: `src/adapters/czyjesteldorado/mcp-client.ts`

Odpowiedzialności:

- handshake `initialize` z MCP
- wywołanie narzędzia `search_jobs`
- mapowanie payloadu MCP do lokalnego modelu `ImportedOffer`

### Domain Filtering

Kluczowe moduły:

- `src/core/filtering/match-offer.ts`
- `src/core/importing/run-import.ts`

Odpowiedzialności:

- dopasowanie oferty do lokalnego profilu
- ocena lokalizacji i trybu pracy
- generowanie priorytetu
- generowanie notatek i labeli
- deduplikacja po `url`

### Worker

Plik wejściowy: `src/worker/run-worker.ts`

Odpowiedzialności:

- polling pending refresh jobs
- scheduler oparty o `REFRESH_CRON`
- wykonywanie realnego importu przez MCP adapter i `runImport`
- zapis statusu oraz statystyk do `import_jobs`

## Data Model

### `job_offers`

Główna tabela ofert. Najważniejsze pola:

- `stanowisko`
- `firma`
- `url` jako unikalny klucz deduplikacji
- `widełki_od`
- `widełki_do`
- `lokalizacja`
- `tryb_pracy`
- `kontrakt`
- `status_ogloszenia`
- `status_aplikacji`
- `priorytet`
- `notatki`
- `data_dodania`
- `ostatnia_weryfikacja`
- `source`
- `source_external_id`
- `created_at`
- `updated_at`

### `import_jobs`

Tabela historii importów. Najważniejsze pola:

- `kind`
- `status`
- `requested_by`
- `payload`
- `stats_fetched`
- `stats_added`
- `stats_rejected`
- `stats_duplicates`
- `error_message`
- `created_at`
- `started_at`
- `finished_at`

## Main Flows

### Manual Refresh

1. Użytkownik wywołuje `POST /imports/refresh`.
2. Runtime tworzy albo zwraca aktywny wpis `import_jobs` ze stanem `pending` lub `running`.
3. Worker pobiera kolejny pending refresh job i oznacza go jako `running`.
4. Worker wykonuje zapytanie do publicznego MCP CzyJestEldorado.
5. `runImport` filtruje oferty i odrzuca duplikaty po `url`.
6. Zaakceptowane rekordy trafiają do `job_offers`.
7. `import_jobs` dostaje statystyki końcowe i stan `succeeded` albo `failed`.

### Scheduled Refresh

1. Worker uruchamia scheduler z `REFRESH_CRON`.
2. Na każdym ticku worker próbuje utworzyć `scheduled_refresh`.
3. Jeśli refresh jest już `pending` albo `running`, nowy job nie powstaje.
4. Pending job przechodzi przez ten sam pipeline co manual refresh.

### Offer Listing

1. `GET /` pobiera oferty z SQLite.
2. Serwer renderuje HTML shell i osadza JSON z ofertami oraz metadane ostatniego refreshu.
3. Przeglądarka ładuje `/assets/offers-app.js`.
4. React renderuje interaktywną tabelę, przycisk refresh i datę ostatniego update.

### Offer Update

1. Klient wysyła `PATCH /offers/:id`.
2. Runtime filtruje payload do dozwolonych pól.
3. SQLite aktualizuje rekord i `updated_at`.

## External Dependencies

- `https://czyjesteldorado.pl/_mcp`
  Jedyny zewnętrzny runtime dependency dla realnego importu.
- SQLite / `better-sqlite3`
  Lokalna persistencja bez zewnętrznego serwera bazy.
- `node-cron`
  Scheduler workera z obsługą timezone.
- React + TanStack Table
  Interaktywny frontend tabelaryczny.

## Constraints and Tradeoffs

- aplikacja jest zoptymalizowana pod jednego lokalnego użytkownika, nie pod multi-user concurrency
- runtime bootstrappuje schemat SQL przy starcie, mimo że w repo są też narzędzia Drizzle
- worker i web współdzielą SQLite, więc deduplikacja refreshu opiera się na stanie `import_jobs`
- brak automatycznego odzyskiwania jobów pozostawionych w stanie `running` po crashu workera

## Key Design Decisions (ADR)

### ADR-001: Monolith with Two Node Runtimes

**Status:** accepted  
**Date:** 2026-04-09

**Context:**  
Projekt ma być prosty w uruchomieniu lokalnie, ale import nie powinien wymuszać przyszłej architektury wyłącznie jednego procesu.

**Decision:**  
Jeden kod źródłowy, jeden obraz Dockera, dwa runtime'y: `web` i `worker`.

**Consequences:**  
Prosty deploy lokalny i klarowny podział odpowiedzialności: `web` przyjmuje trigger, `worker` wykonuje import i scheduler.

### ADR-002: SQLite as the Primary Store

**Status:** accepted  
**Date:** 2026-04-09

**Context:**  
To narzędzie prywatne, lokalne i ma być lekkie operacyjnie.

**Decision:**  
SQLite jako jedyna baza danych, obsługiwana przez `better-sqlite3`.

**Consequences:**  
Brak zewnętrznej infrastruktury i prosty backup, kosztem ograniczeń concurrency i skali.

### ADR-003: Fastify Shell + React Table

**Status:** accepted  
**Date:** 2026-04-09

**Context:**  
Serwer potrzebował prostych endpointów HTTP, ale widok ofert wymagał sortowania, filtrów i sterowania kolumnami.

**Decision:**  
Fastify zostaje cienkim backendem, a `/` renderuje HTML shell z klientowym bundl'em React + TanStack Table.

**Consequences:**  
Lepsza ergonomia frontu bez osobnej aplikacji SPA, ale dochodzi bundling klienta i część logiki renderu po stronie przeglądarki.
