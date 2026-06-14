# Cruise Best Deal

Сбор и сравнение круизных предложений для семьи (2–3 чел., дочка 17 = взрослый тариф). Два основных интерфейса:

| Файл | Назначение |
|------|------------|
| **`cruises-europe-2026.html`** | **Главная витрина** — Med + North, 72 рейса, live-цены Cruisello + VTG, HOT-метки |
| `index.html` | Редирект на `cruises-europe-2026.html` (корень GitHub Pages) |
| `cruises.html` | Старые лиды (VTG ticker, transatlantic и т.д.) |

**Публичный сайт (без локальных серверов):** [kundul02.github.io/cruises-best-deal/](https://kundul02.github.io/cruises-best-deal/) — просмотр таблицы и ссылок «Купить». Кнопка ↻ и VTG работают только локально с `npm run price-server`.

Профиль семьи: [`research/family-profile.json`](research/family-profile.json)

---

## Быстрый старт (Europe 2026)

```bash
cd /Users/artemsirchenko/Projects/cruises-best-deal
npm install

# 1) Один раз — VTG (email + Go, пароль не нужен)
cp .env.example .env          # пропишите VTG_EMAIL=...
npm run vtg-login             # с .env вход автоматический

# 2) Запустить серверы (два терминала)
npm run price-server          # терминал A — API обновления цен :3920
npm run preview               # терминал B — просмотр HTML :8765

# 3) Открыть в браузере
open http://127.0.0.1:8765/cruises-europe-2026.html#north
```

В таблице: **↻ Обновить Cruisello + VTG** → ~10 сек → цены в строке и в панели «Купить» (перезагрузка страницы не нужна).

---

## Локальные серверы

| Сервис | Порт | Команда запуска | Зачем |
|--------|------|-----------------|-------|
| **price-server** | **3920** | `npm run price-server` | Кнопка ↻ в HTML, Cruisello + VTG Playwright |
| **preview** | **8765** | `npm run preview` | Отдаёт HTML/JSON по HTTP (не `file://`) |

### Статус и остановка

```bash
npm run server:status    # что запущено, health price-server, URL preview
npm run server:stop      # остановить оба (price-server + preview)
```

Вручную (если нужно):

```bash
# Остановить price-server
pkill -f "scripts/price-server.mjs"

# Остановить preview
pkill -f "http.server 8765"

# Проверить порт
lsof -i :3920
curl http://127.0.0.1:3920/health
```

**Важно:** если кнопка ↻ пишет «no API» / «manual hints» — запущен **старый** price-server. Сделайте `npm run server:stop` и снова `npm run price-server`. Новый сервер отвечает `"apiVersion": 2`.

---

## Переменные окружения (`.env`)

Файл **не коммитится** (см. `.gitignore`). Шаблон: [`.env.example`](.env.example)

| Переменная | Назначение |
|------------|------------|
| `VTG_EMAIL` | Email для входа на Vacations To Go (Go, без пароля) |
| `PRICE_SERVER_PORT` | Порт API (по умолчанию 3920) |

---

## npm-скрипты (шпаргалка)

### Просмотр и сбор HTML

| Команда | Описание |
|---------|----------|
| `npm run preview` | HTTP-сервер на :8765 |
| `npm run build-html` | Пересобрать `cruises-europe-2026.html` из JSON |
| `npm run server:status` | Статус серверов |
| `npm run server:stop` | Остановить серверы |

### Обновление цен (один круиз)

| Команда | Описание |
|---------|----------|
| `npm run price-server` | Держать запущенным для кнопки ↻ в браузере |
| `npm run refresh-price -- --slug=SLUG --rebuild-html` | CLI: Cruisello + VTG + пересборка HTML |
| `npm run refresh-price -- --slug=SLUG --no-vtg` | Только Cruisello |
| `npm run refresh-price -- --slug=SLUG --agencies` | + CruiseDirect / iCruise (медленно) |

API (пока `price-server` работает):

```bash
curl "http://127.0.0.1:3920/health"
curl "http://127.0.0.1:3920/refresh?slug=YOUR-SLUG"
curl "http://127.0.0.1:3920/refresh?slug=YOUR-SLUG&vtg=0"      # без VTG
curl "http://127.0.0.1:3920/refresh?slug=YOUR-SLUG&agencies=1" # + CD/iCruise
```

### Batch (все 72 круиза)

| Команда | Описание |
|---------|----------|
| `npm run vtg-batch` | VTG цены для всех (нужен `vtg-login`) |
| `npm run vtg-batch -- --region=north` | Только North |
| `npm run go-batch` | Affiliate-ссылки с Cruisello `/go/` |
| `npm run agencies-batch` | CruiseDirect + iCruise Playwright (медленно) |

### Первичный вход (Playwright-профили)

| Команда | Профиль на диске | Когда |
|---------|------------------|-------|
| `npm run vtg-login` | `.playwright-vtg-profile/` | **Обязательно** для VTG |
| `npm run cd-login` | `.playwright-cd-profile/` | Если нужен CruiseDirect (Cloudflare) |

---

## Что делает кнопка ↻ в HTML

```
Браузер  →  GET http://127.0.0.1:3920/refresh?slug=...
              ↓
         price-server.mjs
              ↓
         refresh-cruise.mjs
              ├── Cruisello (fetch HTML, €2/€3)
              ├── Cruisello /go/ (ссылки агентств)
              ├── VTG (Playwright, ~10 с) — MSC/NCL/Celebrity/…
              └── bestPrice → запись в research/*.json
              ↓
         build-html (авто) + ответ → страница перерисовывает строку
```

| Линия | VTG при ↻ |
|-------|-----------|
| MSC, NCL, Celebrity, RCCL, … | ✅ автоматически |
| **TUI, AIDA** | ❌ нет на VTG US — только Cruisello + сайт линии |

Подробнее: [`research/PRICE_REFRESH.md`](research/PRICE_REFRESH.md), [`research/AGENCY_SCRAPING.md`](research/AGENCY_SCRAPING.md)

---

## Данные Europe 2026

| JSON | Регион | Рейсов |
|------|--------|--------|
| `research/summer-med-july-2026.json` | Средиземноморье, с 5 Jul | 47 |
| `research/north-aug-2026.json` | North, с 5 Aug | 25 |

### Пересборка данных с нуля (редко)

```bash
node scripts/fetch-summer-med.mjs       # Cruisello → med JSON
node scripts/fetch-north-aug-2026.mjs   # Cruisello → north JSON
node scripts/enrich-summer-buy.mjs      # buyOptions med
node scripts/enrich-north-aug.mjs       # buyOptions north
node scripts/normalize-buy-options.mjs  # почистить notes, VTG/TUI
npm run go-batch                        # /go/ ссылки
npm run vtg-batch                       # VTG batch
npm run build-html                      # HTML
```

### Дополнительно

```bash
npm run fetch-extra-lines -- --region=north --dry-run  # Princess/HAL с Cruisello
node scripts/probe-cruisedirect.mjs --slug=...
node scripts/probe-icruise.mjs --slug=...
```

---

## UI: HOT, маршрут, семья

- **HOT** — красная строка, лучшее сочетание цены / ночей / линии (несколько на регион). Фильтр **HOT (N)**.
- **Маршрут** — порты со страной: `Kiel (Germany)`, `Geiranger (Norway)`. Справочник: `scripts/lib/port-countries.mjs`.
- **17 лет** — взрослый тариф; смотреть колонки **€ 2 чел.** и **€ 3 чел.**

---

## Витрина лидов (`cruises.html`)

Отдельный pipeline для глобальных лидов (transatlantic, deal score).

```bash
open cruises.html
node scripts/compute-deal-score.mjs
node scripts/inject-verified-registry.mjs
node scripts/archive-expired-leads.mjs
node scripts/export-merged-leads.mjs
```

Промпт «Обновить лиды», deal score, источники: [`research/CRUISE_RESEARCH_WORKFLOW.md`](research/CRUISE_RESEARCH_WORKFLOW.md), [`research/SOURCES_RESEARCH.md`](research/SOURCES_RESEARCH.md)

---

## Структура проекта

```
cruises-europe-2026.html     ← главная витрина (npm run build-html)
cruises.html / index.html    ← лиды (GitHub Pages)

research/
  summer-med-july-2026.json  ← данные Med
  north-aug-2026.json        ← данные North
  PRICE_REFRESH.md           ← VTG / price-server
  AGENCY_SCRAPING.md         ← CD, iCruise, /go/
  family-profile.json
  sources-registry.json
  leads-verified.json        ← для cruises.html

scripts/
  price-server.mjs           ← API :3920
  server-status.mjs          ← npm run server:status
  server-stop.mjs            ← npm run server:stop
  build-unified-cruises-html.mjs
  refresh-cruise-prices.mjs
  batch-vtg-all.mjs
  batch-go-all.mjs
  lib/
    refresh-cruise.mjs       ← Cruisello + VTG + agencies
    vtg-search.mjs           ← Playwright VTG
    hot-deal-score.mjs       ← HOT badges
    port-countries.mjs       ← Kiel (Germany)

.env                         ← VTG_EMAIL (не в git)
.playwright-vtg-profile/     ← сессия VTG (не в git)
```

---

## Для нового чата / агента (Cursor)

**Контекст:** семейный шортлист круизов EU 2026; live-цены Cruisello + VTG; HTML статичный, обновление через локальный `price-server`.

**Перед работой с кнопкой ↻:**

1. `npm run server:status` — price-server должен быть v2 на :3920
2. Если VTG пустой — `npm run vtg-login` (есть `.env` с `VTG_EMAIL`)
3. Preview: `npm run preview` → `http://127.0.0.1:8765/cruises-europe-2026.html`

**Типичные задачи:**

| Задача | Команда |
|--------|---------|
| Обновить один круиз | `npm run refresh-price -- --slug=... --rebuild-html` |
| Обновить все VTG | `npm run vtg-batch` |
| Пересобрать HTML | `npm run build-html` |
| Починить «no API» на ↻ | `npm run server:stop && npm run price-server` |
| TUI без VTG | ожидаемо; не баг |

**Не коммитить:** `.env`, `.playwright-*-profile/`, `node_modules/`

---

## Семья и визы (кратко)

| Параметр | Значение |
|----------|----------|
| Состав | Пара + дочка **17 лет** (= взрослый тариф) |
| Паспорта | Украина, биометрические |
| Шенген | безвиз 90/180 |
| USA/Canada на борту | виза нужна даже без высадки |
| Канада (порт) | дочери нужна CA visa → фильтр `visaWarning: canada` в лидах |

---

## Deploy (GitHub Pages)

```bash
npm run build-html
cp cruises-europe-2026.html index.html   # или cruises.html для лидов
git add -A && git commit -m "..." && git push
```

Settings → Pages → branch `main`, folder root.

---

## Troubleshooting

| Симптом | Решение |
|---------|---------|
| ↻ «Сервер не отвечает» | `npm run price-server` |
| ↻ «no API / manual hints» | `npm run server:stop` → `npm run price-server` (старый процесс) |
| VTG «Нужен вход» | `npm run vtg-login`, проверить `.env` |
| VTG «нет на VTG US» для TUI | норма |
| Кнопка «Купить» не раскрывается | `npm run build-html` + hard refresh |
| CruiseDirect Cloudflare | `npm run cd-login` |
| EADDRINUSE :3920 | `npm run server:stop` или `lsof -i :3920` → kill |
