# Cruise Best Deal

Сбор и сравнение круизных предложений для семьи (2–3 чел., дочка 17 = взрослый тариф).

| Файл | Назначение |
|------|------------|
| **`cruises-europe-2026.html`** | **Главная витрина** — Med + North + Трансатлантика, Cruisello + VTG, HOT, visa, NEW |
| `index.html` | Редирект на витрину (корень GitHub Pages) |
| `cruises.html` | Старые глобальные лиды (отдельный pipeline) |

**Публичный сайт:** [kundul02.github.io/cruises-best-deal/](https://kundul02.github.io/cruises-best-deal/) — просмотр таблицы и ссылок «Купить».

**Live-обновления** (↻, проверка новых круизов, публикация на GitHub) работают **только с Mac**, когда запущены `price-server` + `preview`. На GitHub Pages — статичный снимок.

Профиль семьи: [`research/family-profile.json`](research/family-profile.json)

---

## Быстрый старт

```bash
cd cruises-best-deal
npm install

# 1) Один раз — VTG (email + Go, пароль не нужен)
cp .env.example .env          # VTG_EMAIL=your@email.com
npm run vtg-login             # с .env вход автоматический

# 2) Два терминала — держать открытыми
npm run price-server          # терминал A — API :3920
npm run preview               # терминал B — HTML :8765

# 3) Браузер
open http://127.0.0.1:8765/cruises-europe-2026.html#north
```

Внизу страницы: индикатор **Mac подключён ✓** — значит `price-server` отвечает.

---

## Как пользоваться витриной

### Одна строка круиза — ↻ Обновить Cruisello + VTG

- Обновляет **один** рейс (~10–30 сек)
- Пишет цены в `research/*.json`, пересобирает HTML локально
- **Не** делает `git push` — только ваш Mac

### Блок «Управление с Mac» (внизу страницы)

| Кнопка | Что делает | Время |
|--------|------------|-------|
| **🔍 Проверить новые (вкладка)** | Сканирует Cruisello, добавляет рейсы, которых ещё нет в JSON | 1–5 мин |
| **🔍 Проверить все регионы** | То же для Med + North + Transatlantic | 5–15 мин |
| **↻ Обновить цены вкладки → GitHub** | Cruisello + VTG для всех круизов вкладки → `git push` | минуты |
| **↻ Обновить все цены → GitHub** | То же для ~68 круизов | очень долго |

**Типичный порядок:**

1. **🔍 Проверить новые** — если Cruisello добавил рейсы
2. Новые строки подсвечены синим, бейдж **NEW**, фильтр **NEW (N)** (30 дней)
3. **↻ Обновить цены → GitHub** — когда готовы выложить актуальные цены на сайт

Токены и Cloudflare Tunnel **не нужны** для работы с Mac через `preview`.

---

## Локальные серверы

| Сервис | Порт | Команда | Зачем |
|--------|------|---------|-------|
| **price-server** | **3920** | `npm run price-server` | API: refresh, discover, deploy |
| **preview** | **8765** | `npm run preview` | HTML по HTTP (не `file://`) |

```bash
npm run server:status    # что запущено, /health, URL preview
npm run server:stop      # остановить оба
```

**После обновления кода** или ошибки «Use /health, /refresh…» / «Cruise not found» для новых регионов:

```bash
npm run server:stop && npm run price-server
```

Проверка:

```bash
curl http://127.0.0.1:3920/health
# ожидается: "apiVersion": 2, "discover": true
```

---

## price-server API

Пока `npm run price-server` работает:

```bash
curl http://127.0.0.1:3920/health

# один круиз — Cruisello + VTG, локально
curl "http://127.0.0.1:3920/refresh?slug=YOUR-SLUG"

# без VTG
curl "http://127.0.0.1:3920/refresh?slug=YOUR-SLUG&vtg=0"

# новые круизы с Cruisello (вкладка или all)
curl "http://127.0.0.1:3920/discover?region=transatlantic"
curl "http://127.0.0.1:3920/discover?region=all"

# обновить цены + git push
curl "http://127.0.0.1:3920/deploy?region=north"
curl "http://127.0.0.1:3920/deploy?region=all"
```

| Endpoint | Назначение |
|----------|------------|
| `/health` | Статус, `apiVersion`, `discover` |
| `/refresh?slug=` | Цены одного круиза |
| `/discover?region=med\|north\|transatlantic\|all` | Поиск новых на Cruisello |
| `/deploy?region=` | Batch refresh + `git push` |

Если в `.env` задан `REFRESH_TOKEN` — добавьте `&token=...` (нужно только при публичном tunnel).

---

## Схема: что куда идёт

### ↻ в строке (один круиз)

```
Браузер → GET /refresh?slug=...
       → Cruisello + VTG (Playwright)
       → research/*.json
       → build-html
       → ответ в браузер (строка обновляется)
```

### 🔍 Проверить новые

```
Браузер → GET /discover?region=...
       → fetch-*-*.mjs (Cruisello)
       → merge с JSON (старые buyOptions/VTG сохраняются)
       → новым ставится discoveredAt
       → build-html → reload страницы
```

### ↻ Обновить цены → GitHub

```
Браузер → GET /deploy?region=...
       → /refresh для каждого круиза региона
       → build-html
       → git commit + push origin main
       → GitHub Pages через 1–2 мин
```

| Линия | VTG |
|-------|-----|
| MSC, NCL, Celebrity, RCCL, … | ✅ |
| **TUI, AIDA** | ❌ на VTG US — Cruisello + сайт линии |

Подробнее: [`research/PRICE_REFRESH.md`](research/PRICE_REFRESH.md), [`research/AGENCY_SCRAPING.md`](research/AGENCY_SCRAPING.md)

---

## npm-скрипты

### Ежедневно

| Команда | Описание |
|---------|----------|
| `npm run price-server` | API для кнопок в HTML |
| `npm run preview` | Просмотр на :8765 |
| `npm run server:status` | Статус серверов |
| `npm run server:stop` | Остановить серверы |
| `npm run build-html` | Пересобрать витрину из JSON |

### Обновление данных

| Команда | Описание |
|---------|----------|
| `npm run refresh-price -- --slug=SLUG --rebuild-html` | Один круиз (CLI) |
| `npm run discover-cruises -- --region=med` | Новые круизы (CLI) |
| `npm run discover-cruises -- --region=all` | Все регионы |
| `npm run vtg-batch` | VTG для всех (нужен vtg-login) |
| `npm run vtg-batch -- --region=transatlantic` | VTG только transatlantic |
| `npm run go-batch` | Affiliate `/go/` с Cruisello |

### Первичный сбор (редко)

| Команда | Описание |
|---------|----------|
| `node scripts/fetch-summer-med.mjs` | Cruisello → med JSON |
| `node scripts/fetch-north-aug-2026.mjs` | Cruisello → north JSON |
| `npm run fetch-transatlantic` | Cruisello → transatlantic JSON |
| `node scripts/enrich-north-aug.mjs` | buyOptions north |
| `npm run normalize-buy-options.mjs` | Почистить notes |

### Вход Playwright

| Команда | Когда |
|---------|-------|
| `npm run vtg-login` | **Обязательно** для VTG |
| `npm run cd-login` | CruiseDirect (Cloudflare) |

### Опционально

| Команда | Описание |
|---------|----------|
| `npm run tunnel` | Cloudflare → :3920 (только если нужен ↻ с телефона через интернет) |

---

## Данные Europe 2026

| JSON | Регион | На витрине |
|------|--------|------------|
| `research/summer-med-july-2026.json` | Средиземноморье, Jul–Aug | 47 |
| `research/north-aug-2026.json` | North, Aug | 18 (UK скрыты) |
| `research/transatlantic-fall-2026.json` | EU→US/CA, Aug–Jan | 3 |

**Итого ~68 рейсов** после `npm run build-html`.

- **UK-порты** не показываются (нет UK visa) — [`scripts/lib/visa-warnings.mjs`](scripts/lib/visa-warnings.mjs)
- Фильтр **Без CA** — порты Канады (у дочери нет CA visa)
- **Transatlantic:** Hamburg→NY, Barcelona→Florida; combo «Карибы + финиш NY» на Cruisello почти нет

---

## UI: бейджи и фильтры

| Элемент | Значение |
|---------|----------|
| **HOT** | Лучшее сочетание цены / ночей / линии в регионе |
| **NEW** | Добавлен через «Проверить новые» (30 дней) |
| **Norway / 5 Aug / …** | Подсказки по маршруту |
| **CA ⚠ / US visa** | Визовые ограничения |
| Фильтры **HOT**, **NEW**, **Без CA** | В строке сортировки |

Маршрут: порты со страной (`Kiel (Germany)`). Справочник: `scripts/lib/port-countries.mjs`.

---

## Переменные окружения (`.env`)

Не коммитится. Шаблон: [`.env.example`](.env.example)

| Переменная | Назначение |
|------------|------------|
| `VTG_EMAIL` | Email для VTG (Go, без пароля) |
| `REFRESH_TOKEN` | Опционально — пароль API при публичном tunnel |
| `PRICE_SERVER_PORT` | Порт API (по умолчанию 3920) |
| `EUR_USD_RATE` | Опционально — курс €→$ для сравнения VTG vs Cruisello |

---

## Deploy на GitHub Pages

**С Mac (рекомендуется):** кнопка **↻ Обновить цены → GitHub** внизу витрины.

**Вручную:**

```bash
npm run build-html
git add cruises-europe-2026.html research/*.json index.html
git commit -m "Update cruise vitrine"
git push
```

Settings → Pages → branch `main`, folder `/`.

---

## Структура проекта

```
cruises-europe-2026.html          ← витрина (npm run build-html)

research/
  summer-med-july-2026.json       ← Med
  north-aug-2026.json             ← North
  transatlantic-fall-2026.json    ← Transatlantic
  public-api.json                 ← опционально: tunnel URL для GitHub Pages
  family-profile.json
  PRICE_REFRESH.md

scripts/
  price-server.mjs                ← API :3920 (refresh, discover, deploy)
  discover-cruises.mjs            ← CLI discover
  lib/discover-cruises.mjs        ← merge новых с Cruisello
  build-unified-cruises-html.mjs
  git-deploy.mjs                  ← безопасный push артеfactов
  server-status.mjs / server-stop.mjs
  fetch-summer-med.mjs
  fetch-north-aug-2026.mjs
  fetch-transatlantic-fall.mjs
  lib/refresh-cruise.mjs          ← Cruisello + VTG
  lib/visa-warnings.mjs
  lib/hot-deal-score.mjs

.env                              ← VTG_EMAIL (не в git)
.playwright-vtg-profile/          ← сессия VTG (не в git)
```

---

## Troubleshooting

| Симптом | Решение |
|---------|---------|
| **Mac подключён** не появляется | `npm run price-server` |
| ↻ «Cruise not found» (transatlantic) | `npm run server:stop && npm run price-server` |
| 🔍 «Use /health, /refresh…» | Старый price-server — перезапустить |
| 🔍 «Устаревший price-server» | То же; в `/health` должно быть `"discover": true` |
| VTG «Нужен вход» | `npm run vtg-login`, проверить `.env` |
| TUI без VTG | норма — Cruisello + сайт линии |
| EADDRINUSE :3920 | `npm run server:stop` |
| Кнопки серые | `server:status` → запустить price-server |
| На GitHub Pages ↻ не работает | Откройте `127.0.0.1:8765`, не kundul02.github.io |
| Discover стёр enrichments | `git restore research/*.json` — discover merge сохраняет buyOptions, но не все enrich-поля; при сбое откатить JSON |

---

## Семья и визы (кратко)

| Параметр | Значение |
|----------|----------|
| Состав | Пара + дочка **17 лет** (= взрослый тариф) |
| Паспорта | Украина, биометрические |
| Шенген | безвиз 90/180 |
| USA на борту | US visa обязательна (transatlantic) |
| Canada (порт) | у дочери нет CA visa → фильтр **Без CA** |
| UK | рейсы скрыты — нет UK visa/ETA |

---

## Для Cursor / нового чата

1. `npm run server:status` — price-server v2, `discover: true`
2. `npm run preview` → `http://127.0.0.1:8765/cruises-europe-2026.html`
3. VTG: `npm run vtg-login` + `VTG_EMAIL` в `.env`

| Задача | Команда |
|--------|---------|
| Новые круизы | 🔍 в UI или `npm run discover-cruises -- --region=…` |
| Цены одного | ↻ в строке или `npm run refresh-price -- --slug=…` |
| Опубликовать | ↻ Обновить цены → GitHub в UI |
| Пересобрать HTML | `npm run build-html` |

**Не коммитить:** `.env`, `.playwright-*-profile/`, временные tunnel URL в `public-api.json` без необходимости.
