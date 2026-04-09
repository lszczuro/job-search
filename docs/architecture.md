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

[ Fastify web ] -- fetch --> [ public MCP: https://czyjesteldorado.pl/_mcp ]
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
- ręczne uruchamianie importu przez `POST /imports/refresh`

### Client UI

Plik wejściowy: `src/web/client/offers-app.tsx`

Odpowiedzialności:

- odczyt zserializowanych ofert z HTML
- render tabeli na React 19
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
- uruchomienie importu i zapis statystyk joba

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

Obecny stan:

- moduł istnieje
- ma osobne testy jednostkowe
- reprezentuje docelowy kierunek dla job execution
- nie jest jeszcze końcowym egzekutorem realnego `POST /imports/refresh`

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
2. Runtime tworzy wpis `import_jobs` ze stanem `running`.
3. Web wykonuje zapytanie do publicznego MCP CzyJestEldorado.
4. Surowe oferty są mapowane do lokalnego modelu.
5. `runImport` filtruje oferty i odrzuca duplikaty po `url`.
6. Zaakceptowane rekordy trafiają do `job_offers`.
7. `import_jobs` dostaje statystyki końcowe i stan `succeeded` albo `failed`.

### Offer Listing

1. `GET /` pobiera oferty z SQLite.
2. Serwer renderuje HTML shell i osadza JSON z ofertami.
3. Przeglądarka ładuje `/assets/offers-app.js`.
4. React renderuje interaktywną tabelę.

### Offer Update

1. Klient wysyła `PATCH /offers/:id`.
2. Runtime filtruje payload do dozwolonych pól.
3. SQLite aktualizuje rekord i `updated_at`.

## External Dependencies

- `https://czyjesteldorado.pl/_mcp`
  Jedyny zewnętrzny runtime dependency dla realnego importu.
- SQLite / `better-sqlite3`
  Lokalna persistencja bez zewnętrznego serwera bazy.
- React + TanStack Table
  Interaktywny frontend tabelaryczny.

## Constraints and Tradeoffs

- aplikacja jest zoptymalizowana pod jednego lokalnego użytkownika, nie pod multi-user concurrency
- runtime bootstrappuje schemat SQL przy starcie, mimo że w repo są też narzędzia Drizzle
- import ręczny działa synchronicznie w procesie web, więc dłuższy upstream call blokuje ten request
- worker i `REFRESH_CRON` nie są jeszcze domkniętym schedulerem produkcyjnym

## Key Design Decisions (ADR)

### ADR-001: Monolith with Two Node Runtimes

**Status:** accepted  
**Date:** 2026-04-09

**Context:**  
Projekt ma być prosty w uruchomieniu lokalnie, ale import nie powinien wymuszać przyszłej architektury wyłącznie jednego procesu.

**Decision:**  
Jeden kod źródłowy, jeden obraz Dockera, dwa runtime'y: `web` i `worker`.

**Consequences:**  
Prosty deploy lokalny i miejsce na rozdzielenie odpowiedzialności, ale część logiki nadal jest tymczasowo wykonywana w `web`.

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
