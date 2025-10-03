#!/usr/bin/env python3
"""Download and extract Willhaben EV9 listings.

Fetches the public JSON endpoint the responsive web app uses and emits a
flattened table of key listing fields. The endpoint path can be customised to
hit other searches as well.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from typing import Any, Dict, Iterable, List, Optional, Tuple

API_BASE = "https://www.willhaben.at/webapi/iad/search/atz/seo/"
USER_AGENT = "Mozilla/5.0 (compatible; ev9-sniper/1.0)"
CLIENT_HEADER = "api@willhaben.at;responsive_web;server;1.0.0;"
DEFAULT_PATH = "gebrauchtwagen/auto/kia-gebrauchtwagen/ev9"
DEFAULT_PARAMS = {
    "sort": "3",
}
DEFAULT_FIELDS: Tuple[str, ...] = (
    "title",
    "price",
    "mileage",
    "location",
    "year",
    "fuel",
    "transmission",
    "url",
)
FIELD_MAP = {
    "title": "HEADING",
    "price": "PRICE_FOR_DISPLAY",
    "raw_price": "PRICE",
    "mileage": "MILEAGE",
    "location": "LOCATION",
    "state": "STATE",
    "year": "YEAR_MODEL",
    "fuel": "ENGINE/FUEL_RESOLVED",
    "transmission": "TRANSMISSION_RESOLVED",
    "condition": "CONDITION_RESOLVED",
    "dealer": "ORGNAME",
    "owners": "NO_OF_OWNERS",
    "seats": "NOOFSEATS",
    "body": "CAR_TYPE",
    "url": "SEO_URL",
    "id": "ADID",
}


class FetchError(RuntimeError):
    pass


def build_url(path: str, params: Dict[str, str]) -> str:
    path = path.lstrip("/")
    base = API_BASE if API_BASE.endswith("/") else API_BASE + "/"
    url = urllib.parse.urljoin(base, path)
    if params:
        query = urllib.parse.urlencode(params)
        url = f"{url}?{query}"
    return url


def fetch_json(url: str, timeout: float = 30.0) -> Dict[str, Any]:
    req = urllib.request.Request(url)
    req.add_header("User-Agent", USER_AGENT)
    req.add_header("Accept", "application/json")
    req.add_header("X-WH-Client", CLIENT_HEADER)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                raise FetchError(f"HTTP {resp.status} while fetching {url}")
            payload = resp.read()
    except urllib.error.HTTPError as exc:  # type: ignore[attr-defined]
        raise FetchError(f"HTTP {exc.code} while fetching {url}") from exc
    except urllib.error.URLError as exc:
        raise FetchError(f"Failed to reach {url}: {exc}") from exc

    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise FetchError(f"Invalid JSON in response from {url}") from exc


def flatten_attributes(advert: Dict[str, Any]) -> Dict[str, Any]:
    flat: Dict[str, Any] = {}

    attributes = advert.get("attributes", {})
    for entry in attributes.get("attribute", []):
        name = entry.get("name")
        values = entry.get("values") or []
        if not name or not values:
            continue
        flat[name] = values[0]

    return flat


def extract_listings(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    advert_list = (
        data.get("advertSummaryList", {})
        .get("advertSummary", [])
    )

    results = []
    for advert in advert_list:
        flat = flatten_attributes(advert)
        # Include top-level keys that are not part of attributes but handy.
        for key in ("id", "description"):
            if key in advert:
                flat[key.upper()] = advert[key]
        results.append(flat)

    return results


def resolve_field(field: str, flat: Dict[str, Any]) -> Optional[str]:
    if field not in FIELD_MAP:
        return flat.get(field)

    source_key = FIELD_MAP[field]
    value = flat.get(source_key)
    if value is None:
        return None

    if field == "url":
        return urllib.parse.urljoin("https://www.willhaben.at/iad/", str(value).lstrip("/"))
    return str(value)


def output_listings(
    listings: Iterable[Dict[str, Any]],
    fields: Tuple[str, ...],
    output_format: str,
    fp,
) -> None:
    if output_format == "json":
        structured = []
        for flat in listings:
            row = {}
            for field in fields:
                row[field] = resolve_field(field, flat)
            structured.append(row)
        json.dump(structured, fp, ensure_ascii=False, indent=2)
        fp.write("\n")
        return

    # TSV/CSV output.
    delimiter = "\t" if output_format == "tsv" else ","
    fp.write(delimiter.join(fields) + "\n")
    for flat in listings:
        row = [resolve_field(field, flat) or "" for field in fields]
        escaped = []
        for cell in row:
            if delimiter == "," and ("," in cell or "\"" in cell or "\n" in cell):
                escaped.append('"' + cell.replace('"', '""') + '"')
            else:
                escaped.append(cell)
        fp.write(delimiter.join(escaped) + "\n")


def parse_params(pairs: List[str]) -> Dict[str, str]:
    params = dict(DEFAULT_PARAMS)
    for item in pairs:
        if "=" not in item:
            raise argparse.ArgumentTypeError(f"Invalid param '{item}', expected key=value")
        key, value = item.split("=", 1)
        params[key] = value
    return params


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--path",
        default=DEFAULT_PATH,
        help="Search path below the SEO endpoint",
    )
    parser.add_argument(
        "--param",
        action="append",
        default=[],
        metavar="key=value",
        help="Extra query parameter (can be repeated)",
    )
    parser.add_argument(
        "--fields",
        default=",".join(DEFAULT_FIELDS),
        help="Comma-separated list of fields to output",
    )
    parser.add_argument(
        "--format",
        choices=("json", "tsv", "csv"),
        default="json",
        help="Output format",
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Dump the full JSON payload instead of summarising",
    )
    args = parser.parse_args(argv)

    params = parse_params(args.param)
    fields = tuple(filter(None, (field.strip() for field in args.fields.split(","))))
    if not fields:
        parser.error("No fields specified")

    url = build_url(args.path, params)

    try:
        data = fetch_json(url)
    except FetchError as exc:
        print(exc, file=sys.stderr)
        return 1

    if args.raw:
        json.dump(data, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return 0

    listings = extract_listings(data)
    if not listings:
        print("No listings found", file=sys.stderr)
        return 0

    output_listings(listings, fields, args.format, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
