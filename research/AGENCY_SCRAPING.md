# Агентства: CruiseDirect, iCruise, Cruisello /go/

Расширение пайплайна цен поверх Cruisello + VTG.

## Что уже работает

### Cruisello `/go/` (быстро, без Playwright)

На странице бронирования Cruisello есть блок **«Prefer booking through a travel agency?»** с карточками:

| Агентство | Что извлекаем |
|-----------|----------------|
| **CruiseDirect** | affiliate-ссылка → `cruisedirect.com/search-results` |
| **iCruise** | `icruise.com` |
| Vacations To Go | homepage (цены — через VTG) |
| CruiseCompete | homepage (котировка по email) |

Также: **Continue to {line}** → прямой URL линии (часто deep link на booking).

```bash
npm run go-batch              # все 72 круиза
npm run go-batch -- --region=north
```

Код: `scripts/lib/parse-go-page.mjs`, `scripts/lib/fetch-go-page.mjs`

При каждом **↻ Обновить** в HTML `/go/` ссылки подтягиваются автоматически (быстрый fetch).

---

## CruiseDirect (Playwright)

**Ограничение:** Cloudflare Turnstile на `cruisedirect.com/search-results`. Headless без профиля блокируется.

```bash
# 1) Один раз — пройти Cloudflare в видимом браузере
npm run cd-login
# → дождитесь загрузки search-results → закройте окно

# 2) Проба одного круиза
node scripts/probe-cruisedirect.mjs --slug=fjord-explorer-hellesylt-geiranger~MSC-EURIBIA-20260808-7

# 3) Batch (медленно, ~2 с на круиз)
npm run agencies-batch
npm run agencies-batch -- --no-icruise --region=med
```

Профиль: `.playwright-cd-profile/` (не коммитится).

Код: `scripts/lib/cruisedirect-search.mjs`

---

## iCruise (Playwright)

Без Cloudflare. Поиск через autocomplete на главной (`Any Cruise Line`, `Any Ship`, `Any Month`).

```bash
node scripts/probe-icruise.mjs --slug=...
npm run agencies-batch -- --no-cd    # только iCruise
```

Профиль: `.playwright-icruise-profile/`

Код: `scripts/lib/icruise-search.mjs`

---

## CLI / price-server

```bash
# Cruisello + /go/ + VTG (по умолчанию)
npm run refresh-price -- --slug=... --rebuild-html

# + CruiseDirect + iCruise Playwright (медленно)
npm run refresh-price -- --slug=... --agencies --rebuild-html

# price-server
npm run price-server
curl "http://127.0.0.1:3920/refresh?slug=...&agencies=1"
```

---

## Princess, Holland America и др.

Cruisello **не отдаёт** Princess/HAL в наш диапазон Aug 2026 north (проверено). Скрипт ищет новые линии:

```bash
node scripts/fetch-extra-lines.mjs --region=north --dry-run
node scripts/fetch-extra-lines.mjs --region=med
```

Целевые линии: Princess, Holland America, Cunard, Costa.

Если Cruisello пуст — нужен отдельный scraper сайта линии (TODO). VTG mapping для Princess/HAL уже есть в `scripts/lib/vtg-lines.mjs`.

---

## Архитектура

```
refresh-cruise.mjs
  ├── fetchCruiselloPrices()
  ├── refreshAgencyPrices()
  │     ├── fetchGoPageHtml()     → affiliate URLs
  │     ├── fetchCruiseDirectPrices()  [Playwright]
  │     └── fetchICruisePrices()       [Playwright]
  └── searchVtgPrice()
```

## Следующие шаги

1. Улучшить селекторы CD после `probe-cruisedirect.mjs` на реальной странице post-login
2. iCruise: стабилизировать autocomplete (сейчас хрупко)
3. EUR/USD нормализация в `best-price.mjs` перед сравнением VTG vs CD
4. Princess.com / HAL direct scraper если Cruisello не покрывает
