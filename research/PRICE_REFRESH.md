# Обновление лучшей цены

## Быстрый старт (тест на одном круизе)

```bash
cd /Users/artemsirchenko/Projects/cruises-best-deal
npm install

# 1) Один раз — VTG (email + Go, пароль не нужен)
echo 'VTG_EMAIL=your@email.com' >> .env   # или скопируйте .env.example
npm run vtg-login
# → при .env вход автоматический; иначе вручную email → Go → закрыть окно

# 2) Обновить цены для тестового круиза (MSC Grandiosa, Cannes 5 Jul)
npm run refresh-price -- --rebuild-html

# 3) Или через сервер + кнопку в HTML
npm run price-server
# откройте cruises-europe-2026.html → «Купить» → «↻ Лучшая цена»
```

Тестовый slug по умолчанию:
`french-italian-riviera-cannes-genoa-barcelona~MSC-GRANDIOSA-20260705-7`

Другой круиз:
```bash
npm run refresh-price -- --slug=YOUR-SLUG --rebuild-html
```

Только Cruisello (без VTG):
```bash
npm run refresh-price -- --slug=... --no-vtg --rebuild-html
```

## Что делает система

1. **Cruisello** — live fetch HTML (2 и 3 гостя, inside).
2. **Cruisello /go/** — affiliate-ссылки агентств (CruiseDirect, iCruise) + deep link линии.
3. **Vacations To Go** — Playwright Custom Search (нужен вход).
4. **CruiseDirect / iCruise** (опционально) — Playwright; CD нужен `npm run cd-login`.
5. **Лучшая цена** — сравнивает все площадки с числом в JSON.

Подробнее: [AGENCY_SCRAPING.md](./AGENCY_SCRAPING.md)

Результат пишется в `research/*.json`:
- `bestPrice2` / `bestPrice3` — vendor + price + url
- `lastRefreshed`, `verifiedAt` на каждой площадке

## Ограничения VTG

| Ситуация | Поведение |
|----------|-----------|
| Не выполнен `vtg-login` | Cruisello обновится; VTG → «Нужен вход» |
| **TUI Cruises / AIDA** | Нет на VTG US — только Cruisello и сайт линии |
| CruiseCompete | Котировка по email, не live |
| **CruiseDirect** | Cloudflare — `npm run cd-login`; иначе только ссылка с /go/ |
| **iCruise** | Playwright через `--agencies` или `npm run agencies-batch` |

## Архитектура

```
cruises-europe-2026.html  ──GET /refresh?slug=──►  price-server.mjs
                                                          │
                    refresh-cruise.mjs ◄──────────────────┘
                          ├── fetchCruiselloPrices()
                          ├── searchVtgPrice()  [Playwright + .playwright-vtg-profile/]
                          └── computeBestPrice()
```

Сессия VTG хранится локально в `.playwright-vtg-profile/` (не коммитится).

## Рекомендуемый workflow

1. Отфильтровать круизы в витрине → шортлист 3–5 рейсов.
2. Для каждого: **↻ Лучшая цена** (или CLI).
3. Смотреть зелёную метку **★ vendor €price** в колонках €2 / €3.
4. В «Купить» — строка с бейджем **лучшая** → переход на сайт.
