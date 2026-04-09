# Job Tracker

Lokalny tracker ofert pracy AI/LLM z importem z publicznego MCP CzyJestEldorado, filtrowaniem pod własny profil i webowym interfejsem do przeglądania wyników.

## Co działa

- import ofert z `https://czyjesteldorado.pl/_mcp`
- zapis ofert i historii importu do lokalnej SQLite
- widok webowy na `http://localhost:3000`
- tabela ofert zbudowana na React + TanStack Table
- sortowanie kolumn
- filtrowanie po labelkach generowanych z notatek i priorytetu
- przełączanie widoczności kolumn
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
- `worker`: lekki executor jobów importu

Persistencja jest lokalna:

- baza SQLite w `DATABASE_PATH`
- domyślnie `./data/job-search.db`
- przy Docker Compose dane siedzą w volume `job_tracker_data`

Szczegóły architektury są w [docs/architecture.md](/var/tmp/vibe-kanban/worktrees/f36c-inicjalne-za-o-e/job-search/docs/architecture.md).

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
REFRESH_CRON=0 7 * * *
IMPORT_PHRASE=ai
KNOWN_STACK=nodejs,typescript,openai
PROFILE_KEYWORDS=ai engineer,llm engineer
ALLOWED_CITIES=Gliwice,Katowice,Chorzow,Ruda Slaska,Zabrze,Sosnowiec,Bytom,Siemianowice Slaskie
```

Znaczenie zmiennych:

- `PORT`: port serwera HTTP
- `DATABASE_PATH`: ścieżka do pliku SQLite
- `REFRESH_CRON`: zachowane w konfiguracji, ale scheduler nie jest jeszcze aktywnie spięty end-to-end
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

5. W drugim terminalu możesz uruchomić worker:

```bash
npm run worker
```

6. Otwórz:

```text
http://localhost:3000
```

Uwaga: aktualnie najważniejszy flow importu działa synchronicznie w `POST /imports/refresh` po stronie aplikacji web. Worker istnieje jako osobny element architektury i ma własne testy, ale nie przejmuje jeszcze realnego refreshu z endpointu.

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
  "fetched": 50,
  "added": 3,
  "rejected": 47,
  "duplicates": 0,
  "errors": 0
}
```

Flow wygląda tak:

1. Endpoint wywołuje publiczne MCP CzyJestEldorado.
2. Oferty są mapowane do lokalnego modelu.
3. Lokalny filtr sprawdza dopasowanie do `PROFILE_KEYWORDS` i lokalizacji.
4. System wylicza priorytet i generuje notatki.
5. Duplikaty po `url` są odrzucane.
6. Wynik i statystyki są zapisywane do SQLite.

Po imporcie odśwież stronę główną, a tabela zaczyta dane z lokalnej bazy.

## Interfejs webowy

Strona główna renderuje shell HTML z Fastify, a sama tabela jest hydradowana przez klientowy bundle Reacta.

Tabela wspiera:

- link w kolumnie `Stanowisko`
- sortowanie po kliknięciu nagłówka
- filtrowanie po labelkach
- ukrywanie i pokazywanie kolumn
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

### `POST /imports/refresh`

Uruchamia ręczny import i zwraca statystyki joba.

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

- `POST /imports/refresh` wykonuje import bez kolejki pośredniej; nie deleguje jeszcze pracy do osobnego workera
- scheduler oparty o `REFRESH_CRON` nie jest jeszcze spięty z prawdziwym harmonogramem
- GUI skupia się na tabeli listy, bez osobnego widoku szczegółu oferty
- migracje Drizzle są przygotowane w projekcie, ale runtime zapewnia też własny bootstrap schematu przy starcie

## Dokumentacja

- [docs/README.md](/var/tmp/vibe-kanban/worktrees/f36c-inicjalne-za-o-e/job-search/docs/README.md)
- [docs/architecture.md](/var/tmp/vibe-kanban/worktrees/f36c-inicjalne-za-o-e/job-search/docs/architecture.md)
- [docs/prd/README.md](/var/tmp/vibe-kanban/worktrees/f36c-inicjalne-za-o-e/job-search/docs/prd/README.md)
- [docs/superpowers/specs/2026-04-09-job-tracker-design.md](/var/tmp/vibe-kanban/worktrees/f36c-inicjalne-za-o-e/job-search/docs/superpowers/specs/2026-04-09-job-tracker-design.md)
- [docs/superpowers/plans/2026-04-09-job-tracker.md](/var/tmp/vibe-kanban/worktrees/f36c-inicjalne-za-o-e/job-search/docs/superpowers/plans/2026-04-09-job-tracker.md)
