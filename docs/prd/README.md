# Product Brief: Job Tracker

**Status:** active  
**Owner:** local user  
**Last updated:** 2026-04-09

## Objective

Utrzymywać lokalny, szybki i prosty tracker ofert AI/LLM, który zastępuje ręczne przeglądanie źródła i odkładanie linków do zewnętrznych narzędzi. Produkt ma skracać czas między pojawieniem się oferty a decyzją, czy warto ją obserwować lub aplikować.

## Primary User

- jedna osoba
- użycie lokalne
- preferencja pod role AI/LLM i stack Node.js / TypeScript

## Success Criteria

- użytkownik może uruchomić import bezpośrednio z własnej maszyny
- oferty są lokalnie filtrowane według słów kluczowych i akceptowanych lokalizacji
- lista ofert jest czytelna w jednej tabeli z sortowaniem i kontrolą kolumn
- aplikacja działa bez zewnętrznej bazy danych
- Docker Compose wystarcza do postawienia środowiska lokalnego

## In Scope

- import z publicznego MCP CzyJestEldorado
- zapis ofert i historii importu do SQLite
- lista ofert dostępna przez GUI i JSON API
- edycja wybranych pól oferty przez HTTP
- frontend tabelaryczny z React + TanStack Table
- ręczne odświeżenie danych przez `POST /imports/refresh`
- automatyczne odświeżenie przez worker i cron

## Out of Scope

- system autoryzacji i wiele kont użytkowników
- pełny ATS lub CRM rekrutacyjny
- rozbudowany workflow aplikowania
- produkcyjne kolejkowanie jobów
- zewnętrzna relacyjna baza danych
- osobny frontend SPA z własnym dev serverem

## Current User-Facing Surface

### Web

- `/`
  Widok tabeli ofert z sortowaniem, filtrami labeli i sterowaniem kolumnami.

### API

- `GET /health`
- `GET /offers`
- `PATCH /offers/:id`
- `POST /imports/refresh`

## Product Rules

- oferta jest traktowana jako duplikat po `url`
- oferty są odrzucane lokalnie, jeśli nie pasują do słów kluczowych lub lokalizacji
- priorytet i notatki są wyliczane z danych oferty oraz lokalnej konfiguracji
- interfejs ma wspierać szybkie skanowanie wielu ofert naraz, nie detail-first workflow

## Known Gaps

- brak dedykowanego widoku szczegółu oferty
- brak importu CSV spiętego w bieżącym UI
- brak automatycznego odzyskiwania refresh jobów po awarii workera

## Next Likely Iterations

- prosty panel statystyk importów
- wygodniejsza edycja statusów z poziomu GUI
- odzyskiwanie zawieszonych jobów po restarcie workera
