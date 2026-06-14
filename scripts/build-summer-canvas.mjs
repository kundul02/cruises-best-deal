#!/usr/bin/env node
/** Build med-summer-europe-july-2026.canvas.tsx from summer JSON */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const jsonPath = path.join(root, "research", "summer-med-july-2026.json");
const outPath = path.join(
  process.env.HOME,
  ".cursor/projects/Users-artemsirchenko-Projects-cruises-best-deal/canvases/med-summer-europe-july-2026.canvas.tsx"
);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

function sanitize(c) {
  const out = { ...c };
  if (!out.price2 && out.pricePP) out.price2 = out.pricePP * 2;
  if (out.price2 && (!out.price3 || out.price3 > out.price2 * 2.8)) {
    out.price3Est = true;
    const pp = out.pricePP || out.price2 / 2;
    out.price3 = Math.round(out.price2 + pp * 0.65);
  }
  return out;
}

const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const cruises = raw.cruises.map(sanitize);
const ports = [...new Set(cruises.map((c) => c.port))].sort();

const topSlugs = new Set([
  "french-italian-riviera-cannes-genoa-barcelona~MSC-GRANDIOSA-20260705-7",
  "mediterranean-magic-riviera-barcelona~MSC-GRANDIOSA-20260706-7",
  "ruby-rendezvous-marseille-rome~NCL-EPIC-20260712-7",
]);

// add cheapest per major port
for (const p of ["Marseille", "Barcelona", "Genoa"]) {
  const best = cruises.filter((c) => c.port === p && c.price2).sort((a, b) => a.price2 - b.price2)[0];
  if (best) topSlugs.add(best.slug);
}

const chartPorts = ["Cannes", "Marseille", "Genoa", "Barcelona"];
const chartData = chartPorts.map((p) => {
  const items = cruises.filter((c) => c.port === p && c.price2);
  const avg = items.length ? Math.round(items.reduce((s, c) => s + c.price2, 0) / items.length) : 0;
  return { label: p, value: avg };
});

const tsx = `import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CollapsibleSection,
  Grid,
  H1,
  H2,
  H3,
  Link,
  Pill,
  Row,
  Select,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
} from "cursor/canvas";

type Cruise = {
  slug: string;
  title: string;
  line: string;
  ship: string;
  sailDate: string;
  nights: number;
  port: string;
  country: string;
  itinerary: string[];
  price2: number | null;
  price3: number | null;
  price3Est?: boolean;
  thirdGuestDiscount?: boolean | null;
  hasChildPromo?: boolean;
  cruiselloUrl: string;
  bookUrl: string;
  lineUrl: string;
  childNote: string;
};

const CRUISES: Cruise[] = ${JSON.stringify(cruises, null, 2)};

const PORTS = ["all", ${ports.map((p) => JSON.stringify(p)).join(", ")}] as const;

const MONTHS = ${JSON.stringify(MONTHS)};

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return String(d).padStart(2, "0") + " " + MONTHS[m - 1] + " " + y;
}

function fmtEur(n: number | null) {
  return n == null ? "—" : "€" + n.toLocaleString("en-GB");
}

const TOP_SLUGS = new Set(${JSON.stringify([...topSlugs])});

export default function MedSummerEuropeJuly2026() {
  const [port, setPort] = useCanvasState<(typeof PORTS)[number]>("port", "Marseille");
  const [sort, setSort] = useCanvasState<"date" | "price2" | "price3">("sort", "date");

  const filtered = CRUISES.filter((c) => port === "all" || c.port === port).sort((a, b) => {
    if (sort === "date") return a.sailDate.localeCompare(b.sailDate) || (a.price2 ?? 9e9) - (b.price2 ?? 9e9);
    if (sort === "price2") return (a.price2 ?? 9e9) - (b.price2 ?? 9e9);
    return (a.price3 ?? 9e9) - (b.price3 ?? 9e9);
  });

  const fr = CRUISES.filter((c) => c.country === "France");
  const best2 = [...CRUISES].filter((c) => c.price2).sort((a, b) => (a.price2 ?? 0) - (b.price2 ?? 0))[0];

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <H1>Med Summer 2026 — круизы из Европы</H1>
        <Text tone="secondary">
          Июль–август · с 5 Jul · ${cruises.length} рейсов · 9 портов · Source: Cruisello · ${raw.meta.fetchedAt}
        </Text>
      </Stack>

      <Callout tone="info">
        Цены — итого за каюту (2 или 3 гостя, inside). Дочка 16 лет: обычно взрослый тариф; скидки 3-го гостя — проверьте на сайте.
        Cannes 5 Jul — ближайший старт из Франции.
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat label="Рейсов" value={String(CRUISES.length)} />
        <Stat label="Из Франции" value={String(fr.length)} tone="success" />
        <Stat label="Мин. 2 чел." value={best2 ? fmtEur(best2.price2) : "—"} tone="success" />
        <Stat label="Портов" value={String(PORTS.length - 1)} />
      </Grid>

      <Stack gap={8}>
        <H2>Топ-рекомендации</H2>
        <Grid columns={1} gap={8}>
          {CRUISES.filter((c) => TOP_SLUGS.has(c.slug)).map((c) => (
            <Card key={c.slug}>
              <CardHeader>{fmtDate(c.sailDate) + " · " + c.port + ", " + c.country + " · " + c.nights + " ночей"}</CardHeader>
              <CardBody>
                <Text weight="semibold">{c.line + " · " + c.ship}</Text>
                <CollapsibleSection title="Маршрут" count={c.itinerary.length}>
                  <Text tone="secondary" size="small">{c.itinerary.join(" → ")}</Text>
                </CollapsibleSection>
                <Row gap={8} style={{ marginTop: 8 }} wrap>
                  <Pill tone="success">2 чел. {fmtEur(c.price2)}</Pill>
                  <Pill tone="info">3 чел. {fmtEur(c.price3)}{c.price3Est ? " ~" : ""}</Pill>
                  {c.thirdGuestDiscount ? <Pill tone="warning">3-й гость дешевле?</Pill> : null}
                </Row>
                <Row gap={12} style={{ marginTop: 8 }} wrap>
                  <Link href={c.cruiselloUrl}>Cruisello</Link>
                  <Link href={c.bookUrl}>Забронировать</Link>
                  <Link href={c.lineUrl}>Сайт линии</Link>
                </Row>
              </CardBody>
            </Card>
          ))}
        </Grid>
      </Stack>

      <Stack gap={8}>
        <H2>Средняя цена за 2 человек по порту</H2>
        <Text tone="secondary" size="small">
          Y-axis: mean total EUR (inside, 2 guests) · Jul 5 – Aug 31 · Source: Cruisello
        </Text>
        <BarChart
          categories={${JSON.stringify(chartData.map((d) => d.label))}}
          series={[{ name: "Mean EUR (2 pax)", data: ${JSON.stringify(chartData.map((d) => d.value))} }]}
          valuePrefix="€"
        />
      </Stack>

      <Row gap={16} wrap align="end">
        <Stack gap={4}>
          <H3>Порт</H3>
          <Select
            value={port}
            onChange={(v) => setPort(v as typeof port)}
            options={[
              { value: "all", label: "Все порты" },
              ...PORTS.filter((p) => p !== "all").map((p) => ({ value: p, label: p })),
            ]}
          />
        </Stack>
        <Stack gap={4}>
          <H3>Сортировка</H3>
          <Select
            value={sort}
            onChange={(v) => setSort(v as typeof sort)}
            options={[
              { value: "date", label: "По дате" },
              { value: "price2", label: "По цене 2 чел." },
              { value: "price3", label: "По цене 3 чел." },
            ]}
          />
        </Stack>
      </Row>

      <Stack gap={8}>
        <H2>Все рейсы ({filtered.length})</H2>
        <Table
          striped
          stickyHeader
          headers={["Дата", "Порт", "Н", "Корабль", "Маршрут", "2 чел.", "3 чел.", "Ссылки"]}
          columnAlign={["left", "left", "right", "left", "left", "right", "right", "left"]}
          rowTone={filtered.map((c) => (TOP_SLUGS.has(c.slug) ? "success" : undefined))}
          rows={filtered.map((c) => [
            fmtDate(c.sailDate),
            c.port + ", " + c.country,
            String(c.nights),
            c.line + " · " + c.ship,
            c.itinerary.slice(0, 3).join(", ") + (c.itinerary.length > 3 ? "…" : ""),
            fmtEur(c.price2),
            fmtEur(c.price3) + (c.price3Est ? " ~" : ""),
            <Row gap={8} wrap>
              <Link href={c.cruiselloUrl}>Cruisello</Link>
              <Link href={c.bookUrl}>Book</Link>
            </Row>,
          ])}
        />
      </Stack>

      <Text tone="secondary" size="small">
        HTML-версия с раскрываемым маршрутом:{" "}
        <Link href="file:///Users/artemsirchenko/Projects/cruises-best-deal/med-summer-july-2026.html">
          med-summer-july-2026.html
        </Link>
      </Text>
    </Stack>
  );
}
`;

fs.writeFileSync(outPath, tsx);
console.log(`Built canvas ${outPath} (${cruises.length} cruises)`);
