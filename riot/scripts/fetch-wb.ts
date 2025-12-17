import fs from "fs";
import path from "path";
import YAML from "yaml";

type Entry = {
  name: string;
  year: number;
  gini: number;
  inflation: number;
  unemployment: number;
};

type Dataset = { positives: Entry[]; negatives: Entry[] };

type Indicator =
  | "SI.POV.GINI" // Gini
  | "FP.CPI.TOTL.ZG" // Inflation, consumer prices (annual %)
  | "SL.UEM.TOTL.ZS"; // Unemployment, total (% of total labor force)

const COUNTRY_MAP: Record<string, string> = {
  "Argentina Crisis 2001": "ARG",
  "Hong Kong Protests 2019": "HKG",
  "Chile Protests 2019": "CHL",
  "Watts Riots 1965": "USA",
  "Detroit Riots 1967": "USA",
  "Newark Riots 1967": "USA",
  "May 1968 Protests": "FRA",
  "NYC Blackout Riot 1977": "USA",
  "Brixton Uprising 1981": "GBR",
  "LA Riots 1992": "USA",
  "Banlieue Riots 2005": "FRA",
  "Greek Riots 2008": "GRC",
  "England Riots 2011": "GBR",
  "Yellow Vests 2018": "FRA",
  "Chile Protests 2019 (alt)": "CHL",
  "People Power Revolution 1986": "PHL",
  "Occupy Wall Street 2011": "USA",
  "Euromaidan 2013-2014": "UKR",
  "Gezi Park Protests 2013": "TUR",
  "Umbrella Movement 2014": "HKG",
  "Black Lives Matter 2020": "USA",
  "Hong Kong Protests 2019-2020": "HKG",
  "Belarusian Protests 2020": "BLR",
  "Myanmar Protests 2021": "MMR",
  "Sri Lankan Protests 2022": "LKA",
  "Kazakh Unrest 2022": "KAZ",
  "Sierra Leone Protests 2022": "SLE",
  "Malawi Protests 2025": "MWI",
  "Lebanon Protests 2019": "LBN",
  "Tunisia Uprising 2010": "TUN",

  // negatives
  "Norway 2010s": "NOR",
  "Japan 1980s": "JPN",
  "Germany 2010s": "DEU",
  "Denmark 2015": "DNK",
  "Canada 2015": "CAN",
  "Singapore 2000s": "SGP",
  "Switzerland 2024": "CHE",
};

const INDICATOR_LABELS: Record<Indicator, keyof Entry> = {
  "SI.POV.GINI": "gini",
  "FP.CPI.TOTL.ZG": "inflation",
  "SL.UEM.TOTL.ZS": "unemployment",
};

type WBResponse = [ { page: number; pages: number; per_page: string; total: number }, Array<{ date: string; value: number | null }> ];

const fetchIndicator = async (
  country: string,
  indicator: Indicator,
  year: number
): Promise<{ value: number | null; sourceUrl: string; yearUsed: number }> => {
  // one call: range 1960:year ordered desc; per_page=1 gives latest available <= year
  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?date=1960:${year}&format=json&per_page=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`WB ${indicator} ${country} status ${res.status}`);
    const json = (await res.json()) as WBResponse;
    const val = json[1]?.[0]?.value ?? null;
    const yearUsed = Number(json[1]?.[0]?.date ?? year);
    return { value: val, sourceUrl: url, yearUsed };
  } finally {
    clearTimeout(timer);
  }
};

const main = async () => {
  const dataPath = path.resolve(new URL("../data/protests.yaml", import.meta.url).pathname);
  const raw = fs.readFileSync(dataPath, "utf8");
  const dataset = YAML.parse(raw) as Dataset;

  const all = [...dataset.positives, ...dataset.negatives];

  const updated: Record<string, Partial<Entry>> = {};
  const sources: Record<string, Record<string, string>> = {};

  for (const entry of all) {
    const code = COUNTRY_MAP[entry.name];
    if (!code) {
      console.warn(`No country code for ${entry.name}`);
      continue;
    }
    sources[entry.name] = {};
    updated[entry.name] = {};

    for (const indicator of ["SI.POV.GINI", "FP.CPI.TOTL.ZG", "SL.UEM.TOTL.ZS"] as Indicator[]) {
      try {
        const { value, sourceUrl, yearUsed } = await fetchIndicator(code, indicator, entry.year);
        if (value !== null) {
          const key = INDICATOR_LABELS[indicator];
          const adjusted =
            indicator === "SI.POV.GINI" && value > 1 ? value / 100 : value; // WB returns 0-100 scale
          updated[entry.name][key] = Number(adjusted.toFixed(3));
          sources[entry.name][key] = `${sourceUrl} (year ${yearUsed})`;
        } else {
          console.warn(`Missing ${indicator} for ${entry.name}`);
        }
      } catch (err) {
        console.warn(`Error fetching ${indicator} for ${entry.name}: ${(err as Error).message}`);
      }
    }
  }

  const applyUpdates = (entries: Entry[]) =>
    entries.map((e) => {
      const up = updated[e.name];
      if (!up) return e;
      return {
        ...e,
        gini: up.gini ?? e.gini,
        inflation: up.inflation ?? e.inflation,
        unemployment: up.unemployment ?? e.unemployment,
      };
    });

  const newDataset: Dataset = {
    positives: applyUpdates(dataset.positives),
    negatives: applyUpdates(dataset.negatives),
  };

  const newYaml = YAML.stringify(newDataset, { indent: 2, lineWidth: 0 });
  fs.writeFileSync(dataPath, newYaml);

  console.log("Updated protests.yaml from World Bank where available.");
  console.log("Sources:");
  for (const [name, src] of Object.entries(sources)) {
    console.log(`- ${name}`);
    for (const [k, url] of Object.entries(src)) {
      console.log(`    ${k}: ${url}`);
    }
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
