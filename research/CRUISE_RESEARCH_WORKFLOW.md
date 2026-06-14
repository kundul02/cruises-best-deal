# Workflow: верификация круизных лидов

Каждый лид на витрине должен иметь **проверенные по официальному источнику** поля.

## Главное правило

1. **WebFetch** конкретной страницы предложения (агрегатор или линия).
2. **Записать** в `leads-verified.json` по `id`.
3. **Только потом** — публикация на сайте (`status: "verified"`).
4. Без шага 1–2 — `needs_manual_check`, не показывать как проверенный.

## Источник правды

| Файл | Роль |
|------|------|
| [`leads-verified.json`](leads-verified.json) | Верифицированные поля по `id` |
| [`leads-registry.json`](leads-registry.json) | active / watch / archive + checkLog |
| [`sources-registry.json`](sources-registry.json) | Откуда искать новые лиды |
| [`family-profile.json`](family-profile.json) | Визы, состав, регионы |
| [`cruises.html`](../cruises.html) | Публичная витрина |

## Обязательные поля

```json
{
  "1": {
    "summary": "1–2 предложения: маршрут, линия, ключевая цена",
    "desc": "Каюта · порты · inclusions · visa notes",
    "sailDate": "2026-10-15",
    "nights": 7,
    "pricePerPerson": 952,
    "currency": "USD",
    "inclusions": ["$100 OBC"],
    "visaNotes": "Шенген OK · US visa если embark Miami",
    "documents": ["Биопаспорт", "Подтверждение брони", "Страховка"],
    "sources": ["https://..."],
    "verifiedAt": "2026-06-14",
    "closed": false
  }
}
```

## Чеклист агента

1. Открыть `sourceUrl` и `bookingUrl`.
2. Сверить цену, даты, каюту, inclusions.
3. Проверить visa fit по `family-profile.json`.
4. Записать в `leads-verified.json`.
5. `node scripts/compute-deal-score.mjs`
6. `node scripts/inject-verified-registry.mjs`
7. `node scripts/archive-expired-leads.mjs`
8. Запись в `checkLog` в `leads-registry.json`.

## Новые лиды из LATEST_FEED

1. Research → `leads-verified.json`
2. Добавить в `leads-registry.json` → `active[]`
3. Без verified — `needs_manual_check`

## Периодичность

| Источник | Частота |
|----------|---------|
| VTG 90-Day Ticker | Ежедневно (сезон) |
| CruisePlum drops | 2–3 дня |
| Cruise Critic | 2–3 дня |
| Repositioning (сен–ноя) | Еженедельно |
| Wave Season | Еженедельно |

## Архивация

`sailDate` прошёл → `closed: true`, перенос в `archive[]`:
`node scripts/archive-expired-leads.mjs`
