# Job Tracker

Lokalny tracker ofert pracy AI/LLM z importem z publicznego MCP CzyJestEldorado, filtrowaniem pod własny profil i webowym interfejsem do przeglądania wyników.

## Co działa

- import ofert z `https://czyjesteldorado.pl/_mcp`
- zapis ofert i historii importu do lokalnej SQLite
- widok webowy na `http://localhost:3000`
- tabela ofert zbudowana na React + TanStack Table
- sortowanie kolumn
- filtry per-kolumna: tekstowe, datowe, wielokrotnego wyboru, zakresowe numeryczne
- przełączanie widoczności kolumn
- inline editing dla `status_aplikacji`, `priorytet` i `status_ogloszenia`
- ręczne odświeżenie importu przez HTTP
- uruchamianie przez Node lokalnie albo przez Docker Compose

## Stack

- Node.js + TypeScript
- Fastify
- React 19
- TanStack Table
- SQLite
- Drizzle ORM
- esbuild
- Vitest

## Architektura w skrócie

Aplikacja działa jako jeden kod źródłowy z dwoma runtime'ami:

- `web`: Fastify, HTML shell, asset klientowy Reacta, endpointy HTTP
- `worker`: scheduler i executor jobów importu

Persistencja jest lokalna:

- baza SQLite w `DATABASE_PATH`
- domyślnie `./data/job-search.db`
- przy Docker Compose dane siedzą w volume `job_tracker_data`

Szczegóły architektury są w [docs/architecture.md](/var/tmp/vibe-kanban/worktrees/eed8-wire-automatic-o/job-search/docs/architecture.md).

## Wymagania

- Node.js 22+ albo aktualny LTS
- `npm`
- opcjonalnie Docker + Docker Compose

## Konfiguracja

Podstawą jest plik `.env`. Najprościej zacząć od `.env.example`.

Przykładowa konfiguracja:

```env
PORT=3000
DATABASE_PATH=./data/job-search.db
REFRESH_CRON=*/30 * * * *
APP_TIMEZONE=Europe/Warsaw
IMPORT_PHRASE=ai
KNOWN_STACK=nodejs,typescript,openai
PROFILE_KEYWORDS=ai engineer,llm engineer
ALLOWED_CITIES=Gliwice,Katowice,Chorzow,Ruda Slaska,Zabrze,Sosnowiec,Bytom,Siemianowice Slaskie
```

Znaczenie zmiennych:

- `PORT`: port serwera HTTP
- `DATABASE_PATH`: ścieżka do pliku SQLite
- `REFRESH_CRON`: cron dla schedulera workera; domyślnie co 30 minut
- `APP_TIMEZONE`: timezone używany przez scheduler i formatowanie dat w GUI
- `IMPORT_PHRASE`: fraza wysyłana do MCP `search_jobs`
- `KNOWN_STACK`: technologie wpływające na priorytet i notatki
- `PROFILE_KEYWORDS`: słowa kluczowe do lokalnego odrzucania ofert
- `ALLOWED_CITIES`: miasta akceptowane dla `Hybrid` i `Office`

## Uruchomienie lokalne

1. Przygotuj `.env` na bazie `.env.example`.
2. Zainstaluj zależności:

```bash
npm install
```

3. Opcjonalnie uruchom migracje:

```bash
npm run db:migrate
```

4. Uruchom serwer web:

```bash
npm run web
```

5. W drugim terminalu uruchom worker:

```bash
npm run worker
```

6. Otwórz:

```text
http://localhost:3000
```

`web` tylko enqueue'uje manual refresh i renderuje GUI. `worker wykonuje pending refresh jobs`, odpala scheduler z `REFRESH_CRON` i zapisuje wynik do `import_jobs`.

## Docker

Start:

```bash
docker compose up -d --build
```

Usługi:

- `web` wystawia aplikację na porcie `3000`
- `worker` startuje osobny proces Node dla runtime workera

Compose ładuje zmienne z `.env`, więc ten plik musi istnieć obok `docker-compose.yml`.

Po starcie otwórz:

```text
http://localhost:3000
```

## CI / publikacja obrazu

Repo publikuje obraz kontenera do `ghcr.io` przez GitHub Actions.

- push do `main` buduje projekt i publikuje tag `latest`
- push taga git w formacie `vX.Y.Z` buduje projekt i publikuje tag obrazu `X.Y.Z`

Workflow przed publikacją wykonuje:

- `npm ci`
- `npm test`
- `npm run build`

## Import ofert

Źródło danych:

- publiczny serwer MCP: `https://czyjesteldorado.pl/_mcp`

Ręczne odświeżenie:

```bash
curl -X POST http://localhost:3000/imports/refresh
```

Przykładowa odpowiedź:

```json
{
  "id": 1,
  "kind": "manual_refresh",
  "status": "pending",
  "reused": false
}
```

Flow wygląda tak:

1. `POST /imports/refresh` tworzy albo zwraca istniejący aktywny refresh job.
2. Worker pobiera pending job z `import_jobs`.
3. Worker wywołuje publiczne MCP CzyJestEldorado.
4. `runImport` filtruje oferty, liczy duplikaty i zapisuje zaakceptowane rekordy.
5. Worker zapisuje status, statystyki i ewentualny błąd do `import_jobs`.

Scheduler działa w procesie `worker` według `REFRESH_CRON`, domyślnie co 30 minut. Jeśli refresh jest już `pending` albo `running`, worker nie tworzy duplikatu.

Po imporcie odśwież stronę główną. GUI pokazuje przycisk ręcznego refreshu i datę ostatniego udanego update w `APP_TIMEZONE`.

## Interfejs webowy

Strona główna renderuje shell HTML z Fastify, a sama tabela jest hydradowana przez klientowy bundle Reacta.

Tabela wspiera:

- przycisk `Odśwież oferty`
- znacznik `Ostatni update`
- link w kolumnie `Stanowisko`
- sortowanie po kliknięciu nagłówka
- per-kolumnowe filtry w nagłówku tabeli:
  - filtry tekstowe (`Stanowisko`, `Firma`, `Lokalizacja`) — dopasowanie podciągu
  - filtry datowe (`Data dodania`, `Ostatnia weryfikacja`) — dokładny dzień
  - filtry wielokrotnego wyboru (`Status aplikacji`, `Kontrakt`, `Priorytet`, `Status ogłoszenia`, `Tryb pracy`) — dropdown z checkboxami
  - filtr labeli notatek (`Notatki`) — dropdown z checkboxami, wartości z notatek ofert
  - filtry zakresu numerycznego (`Widełki od`, `Widełki do`) — pole min/max
- filtry łączą się logicznym AND między kolumnami, OR wewnątrz jednej kolumny wielokrotnego wyboru
- pasek aktywnych filtrów: liczba wyników, chipy z możliwością usunięcia, przycisk `Wyczyść wszystkie filtry`
- filtrowanie notatek zastąpiło poprzedni globalny filtr labeli
- ukrywanie i pokazywanie kolumn
- inline edycję pól `status_aplikacji`, `priorytet` i `status_ogloszenia`
- automatyczny zapis zmian przez `PATCH /offers/:id` bez przeładowania strony
- widoczne statusy `Zapisywanie...`, `Zapisano` i komunikat błędu przy nieudanym zapisie
- `Notatki` renderowane jako same labele do filtrowania, bez pola edycji
- poziomy scroll przy szerokim zestawie pól

Aktualny zestaw kolumn:

- `Stanowisko`
- `Status aplikacji`
- `Data dodania`
- `Firma`
- `Kontrakt`
- `Lokalizacja`
- `Notatki`
- `Widełki od`
- `Widełki do`
- `Ostatnia weryfikacja`
- `Priorytet`
- `Status ogłoszenia`
- `Tryb pracy`

## HTTP API

### `GET /health`

Zwraca status aplikacji:

```json
{ "ok": true }
```

### `GET /offers`

Zwraca listę ofert jako JSON.

### `PATCH /offers/:id`

Pozwala zmienić tylko te pola:

- `priorytet`
- `status_aplikacji`
- `status_ogloszenia`
- `notatki`

GUI na stronie głównej używa tego endpointu do automatycznej inline edycji pól `priorytet`, `status_aplikacji` i `status_ogloszenia` w tabeli ofert.

### `POST /imports/refresh`

Tworzy albo zwraca aktywny job typu `manual_refresh` i odpowiada `202 Accepted`.

## Baza danych

Tabela `job_offers` przechowuje m.in.:

- stanowisko
- firma
- `url` jako unikalny identyfikator duplikatów
- widełki
- lokalizację
- tryb pracy
- kontrakt
- statusy
- notatki
- daty techniczne

Tabela `import_jobs` przechowuje:

- typ joba
- status
- liczniki `fetched`, `added`, `rejected`, `duplicates`
- błąd i znaczniki czasu

## Testy i build

Podstawowe komendy:

```bash
npm test
npm run build
```

Dodatkowo w repo są smoke testy dla README i dla podstawowego przepływu Dockera.

## Ograniczenia bieżącej wersji

- aplikacja zakłada pojedynczego lokalnego użytkownika i jeden proces `worker`
- job pozostawiony w stanie `running` po awarii workera nie jest jeszcze automatycznie odzyskiwany
- GUI skupia się na tabeli listy, bez osobnego widoku szczegółu oferty
- migracje Drizzle są przygotowane w projekcie, ale runtime zapewnia też własny bootstrap schematu przy starcie

## Dokumentacja

- [docs/README.md](/var/tmp/vibe-kanban/worktrees/eed8-wire-automatic-o/job-search/docs/README.md)
- [docs/architecture.md](/var/tmp/vibe-kanban/worktrees/eed8-wire-automatic-o/job-search/docs/architecture.md)
- [docs/prd/README.md](/var/tmp/vibe-kanban/worktrees/eed8-wire-automatic-o/job-search/docs/prd/README.md)
- [docs/superpowers/specs/2026-04-09-job-tracker-design.md](/var/tmp/vibe-kanban/worktrees/eed8-wire-automatic-o/job-search/docs/superpowers/specs/2026-04-09-job-tracker-design.md)
- [docs/superpowers/specs/2026-04-09-automatic-refresh-design.md](/var/tmp/vibe-kanban/worktrees/eed8-wire-automatic-o/job-search/docs/superpowers/specs/2026-04-09-automatic-refresh-design.md)
- [docs/superpowers/plans/2026-04-09-job-tracker.md](/var/tmp/vibe-kanban/worktrees/eed8-wire-automatic-o/job-search/docs/superpowers/plans/2026-04-09-job-tracker.md)
- [docs/superpowers/plans/2026-04-09-automatic-refresh.md](/var/tmp/vibe-kanban/worktrees/eed8-wire-automatic-o/job-search/docs/superpowers/plans/2026-04-09-automatic-refresh.md)
