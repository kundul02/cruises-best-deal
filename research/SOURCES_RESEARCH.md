# Источники круизных предложений — сводка

Обновлено: **2026-06-14**. Машиночитаемый реестр: [`sources-registry.json`](sources-registry.json).

## Tier 1 — горячие сделки (проверять чаще)

| Источник | URL | Что искать | Частота |
|----------|-----|------------|---------|
| **Vacations To Go** | https://www.vacationstogo.com/ | [90-Day Ticker](https://www.vacationstogo.com/ticker.cfm), Europe, Custom Search | Ежедневно в сезон |
| **CruisePlum** | https://www.cruiseplum.com/ | Price drops 15%+, hot deals, $/night sort | 2–3 дня |
| **CruiseCompete** | https://www.cruisecompete.com/ | Котировки агентов по конкретному sailing | По запросу |

**VTG workflow:** Wave Season (янв–мар) → early bird; **75–90 дней** до отплытия → второй пик; Ticker → last-minute до −85%.

## Tier 2 — сравнение цен

| Источник | URL | Регион | Особенность |
|----------|-----|--------|-------------|
| GET.cruises | https://get.cruises/ | UK/EU | Price history, alerts |
| Hello Cruise | https://hellocruise.co.uk/ | UK | Skyscanner для круизов |
| Cruisello | https://cruisello.com/cruises | Global | URL-фильтры, sortBy=price_per_night |
| ChooseCruise | https://choose-cruise.com/ | EU/US | App price drops |
| Cruise Critic Deals | https://www.cruisecritic.com/cruise-deals | Global | Deal Score |
| CruiseAlert | https://www.cruisealert.com/ | 32 lines | Price history, refund windows |

## Tier 3 — дискаунтеры и агенты

| Источник | URL | Фокус |
|----------|-----|-------|
| CruiseCheap | https://www.cruisecheap.com/ | Transatlantic from ~$558 |
| CruiseDirect | https://www.cruisedirect.com/destination/europe | US→Europe |
| BestPriceCruises | https://www.bestpricecruises.com/ | Norway, Med, Baltic |
| Seascanner | https://www.seascanner.co.uk/ | UK/EU agent |
| Cruise118 | https://www.cruise118.com/ | UK specialist |

## Прямые линии — по регионам

### Северная Европа / Норвегия / UK
Hurtigruten, Princess, Celebrity, Holland America, MSC, NCL, Royal Caribbean, Cunard, P&O, Fred. Olsen, Ambassador

### Средиземноморье / Греция / Турция / Израиль
Celebrity, Princess, MSC, Costa, NCL, Royal Caribbean, Celestyal, Azamara, Explora, Virgin Voyages

### Трансатлантика / repositioning
Cunard QM2 (year-round 7-night), MSC/NCL/Princess/Celebrity (Sep–Nov EU→Americas, Apr–May обратно). Скидка 40–70% vs regular.

### Америка / Канада
Princess, NCL, Royal Caribbean, Carnival, Holland America, Disney (family)

## Форумы и комьюнити

| Ресурс | URL |
|--------|-----|
| Cruise Critic Forums | https://boards.cruisecritic.com/ (Saving Money, Europe, Transatlantic) |
| r/Cruise | https://www.reddit.com/r/Cruise/ |
| CruiseVoices | https://cruisevoices.com/ |
| CruiseFever | https://cruisefever.net/ |
| Rick Steves Forum | https://community.ricksteves.com/ |
| Travel Arbitrage | https://www.travelarbitrage.net/en/cruise/ |

## Расписание мониторинга

| Период | Действие |
|--------|----------|
| Wave Season (янв–мар) | Еженедельно — early bird |
| 90-day window | Каждые 2–3 дня |
| VTG Ticker | Ежедневно в активный сезон |
| Repositioning (сен–ноя) | Еженедельно — transatlantic |

## Что не используем на старте

- B2B API (Traveltek, Widgety, track.cruises) — платно
- Постоянный scraping VTG/CruisePlum — ToS, anti-bot
- Азия / Тихий океан — вне scope
