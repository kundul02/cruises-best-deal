# Чеклист: проверка круизных лидов

Скопируй промпт в Cursor:

```
Проверь круизные лиды по research/leads-registry.json и sources-registry.json.
Ищи hot deals на VacationsToGo 90-Day Ticker, CruisePlum price drops, Cruise Critic, прямых сайтах линий.
Обнови cruises.html, запусти archive-expired-leads.mjs и inject-verified-registry.mjs.
```

## Агент должен

1. Пройти `aggregators[]` tier 1–2 из [`sources-registry.json`](sources-registry.json).
2. Выполнить `searchQueries[]` + региональные фильтры (Med, Norway, UK, Transatlantic).
3. Сверить `active[]` в [`leads-registry.json`](leads-registry.json) — цена и дата актуальны.
4. Новые hot deals → `leads-registry.json` + карточка в `cruises.html`.
5. `sailDate` прошёл → `closed: true`, archive.
6. **Верификация:** WebFetch → `leads-verified.json` → `inject-verified-registry.mjs`.
7. **Visa check:** сверить с [`family-profile.json`](family-profile.json); CA ports → warning для дочери.
8. `node scripts/compute-deal-score.mjs`
9. `cp cruises.html index.html`
10. Запись в `checkLog`.

## Приоритет источников (сегодня)

1. https://www.vacationstogo.com/ticker.cfm
2. https://www.cruiseplum.com/deals/price-drops
3. https://www.cruisecritic.com/cruise-deals (фильтр Europe, Mediterranean, Transatlantic)
4. https://www.cruisecheap.com/cruises/transatlantic-cruises.html
5. Прямые: Princess, Celebrity, MSC, Cunard, Hurtigruten

## Формат карточки

| Поле | Правило |
|------|---------|
| `summary` | Маршрут + линия + цена pp одной фразой |
| `desc` | `Каюта · N ночей · Порты · Inclusions · Visa` |
| `urgent` | true если отплытие < 30 дней или VTG FastDeal |
| `dealScore` | 0–100 после compute-deal-score.mjs |
| `visaWarning` | `canada` если порт CA и не все имеют CA visa |

## После проверки

```bash
node scripts/archive-expired-leads.mjs
node scripts/compute-deal-score.mjs
node scripts/inject-verified-registry.mjs
node scripts/export-merged-leads.mjs
```

Dry-run архивации: `node scripts/archive-expired-leads.mjs --dry-run`
