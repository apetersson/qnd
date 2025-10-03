#!/usr/bin/env python3
"""Rank EV9 listings using personal value weights from preferences.yaml."""
from __future__ import annotations

import argparse
import math
from pathlib import Path
from typing import Any, Dict, Iterable, List

try:
    import yaml  # type: ignore
except ImportError as exc:  # pragma: no cover
    raise SystemExit("PyYAML is required: pip install pyyaml") from exc

from fetch_ev9_listings import (
    DEFAULT_PARAMS,
    DEFAULT_PATH,
    build_url,
    extract_listings,
    fetch_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--preferences",
        default="preferences.yaml",
        type=Path,
        help="Path to YAML file with weighting parameters",
    )
    parser.add_argument(
        "--path",
        default=DEFAULT_PATH,
        help="Search path for the API request",
    )
    parser.add_argument(
        "--param",
        action="append",
        default=[],
        metavar="key=value",
        help="Additional query param (repeatable)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=24,
        help="Limit output rows",
    )
    return parser.parse_args()


def parse_params(param_list: Iterable[str]) -> Dict[str, str]:
    params = dict(DEFAULT_PARAMS)
    for item in param_list:
        if "=" not in item:
            raise SystemExit(f"Invalid param '{item}', expected key=value")
        key, value = item.split("=", 1)
        params[key] = value
    return params


def load_preferences(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise SystemExit(f"Preferences file not found: {path}")
    with path.open() as fh:
        return yaml.safe_load(fh) or {}


def determine_drivetrain(flat: Dict[str, Any]) -> str:
    text = " ".join(
        filter(
            None,
            (
                flat.get("CAR_MODEL/MODEL_SPECIFICATION"),
                flat.get("HEADING"),
            ),
        )
    ).upper()
    if "AWD" in text:
        return "AWD"
    if "RWD" in text:
        return "RWD"
    return "Unk"


def trim_bonus(flat: Dict[str, Any], pref: Dict[str, Any]) -> float:
    trim_map: Dict[str, Any] = pref.get("trim_bonus", {})
    text = " ".join(
        filter(
            None,
            (
                flat.get("CAR_MODEL/MODEL_SPECIFICATION", ""),
                flat.get("HEADING", ""),
            ),
        )
    ).lower()
    bonus_total = 0.0
    matched = False
    for key, bonus in trim_map.items():
        if key == "default":
            continue
        if key.lower() in text:
            bonus_total += float(bonus)
            matched = True
    if not matched and "default" in trim_map:
        bonus_total += float(trim_map["default"])
    return bonus_total


def option_bonus(flat: Dict[str, Any], pref: Dict[str, Any]) -> float:
    keywords: Dict[str, Any] = pref.get("option_keywords", {})
    text = " ".join(
        filter(
            None,
            (
                flat.get("CAR_MODEL/MODEL_SPECIFICATION", ""),
                flat.get("HEADING", ""),
                flat.get("BODY_DYN", ""),
            ),
        )
    ).lower()
    bonus = 0.0
    for key, value in keywords.items():
        if key.lower() in text:
            bonus += float(value)
    return bonus


def age_penalty(flat: Dict[str, Any], pref: Dict[str, Any]) -> float:
    base_year = int(pref.get("reference_year", 2025))
    year = flat.get("YEAR_MODEL")
    if not year or not str(year).isdigit():
        return float(pref.get("age_penalty_per_year", 0))
    diff = base_year - int(year)
    if diff <= 0:
        return 0.0
    return diff * float(pref.get("age_penalty_per_year", 0))


def mileage_penalty(flat: Dict[str, Any], pref: Dict[str, Any]) -> float:
    km_penalty = float(pref.get("km_penalty_per_1000", 0))
    if km_penalty == 0:
        return 0.0
    mileage = float(flat.get("MILEAGE") or 0)
    penalty = (mileage / 1000.0) * km_penalty
    cap = float(pref.get("max_km_penalty", math.inf))
    return min(penalty, cap)


def drivetrain_bonus(flat: Dict[str, Any], pref: Dict[str, Any]) -> float:
    mapping: Dict[str, Any] = pref.get("drivetrain_bonus", {})
    drivetrain = determine_drivetrain(flat)
    return float(mapping.get(drivetrain, mapping.get("default", 0)))


def compute_personal_value(flat: Dict[str, Any], pref: Dict[str, Any]) -> Dict[str, Any]:
    try:
        price = float(flat.get("PRICE") or flat.get("PRICE/AMOUNT") or 0.0)
    except (TypeError, ValueError):
        price = 0.0

    bonus_total = (
        drivetrain_bonus(flat, pref)
        + trim_bonus(flat, pref)
        + option_bonus(flat, pref)
    )
    penalty_total = age_penalty(flat, pref) + mileage_penalty(flat, pref)
    personal_price = price - bonus_total + penalty_total

    path = str(flat.get("SEO_URL", ""))
    if path:
        if not path.startswith("iad/"):
            path = "iad/" + path.lstrip("/")
        full_url = "https://www.willhaben.at/" + path
    else:
        full_url = "https://www.willhaben.at/"

    return {
        "price": price,
        "personal_price": personal_price,
        "bonus": bonus_total,
        "penalty": penalty_total,
        "drivetrain": determine_drivetrain(flat),
        "year": flat.get("YEAR_MODEL"),
        "mileage": float(flat.get("MILEAGE") or 0),
        "title": flat.get("HEADING"),
        "trim": flat.get("CAR_MODEL/MODEL_SPECIFICATION"),
        "location": flat.get("LOCATION"),
        "state": flat.get("STATE"),
        "url": full_url,
    }


def main() -> int:
    args = parse_args()
    params = parse_params(args.param)
    prefs = load_preferences(args.preferences)

    url = build_url(args.path, params)
    data = fetch_json(url)
    listings = extract_listings(data)

    scored: List[Dict[str, Any]] = []
    for flat in listings:
        scored.append(compute_personal_value(flat, prefs))

    scored.sort(key=lambda item: item["personal_price"])

    header = f"{'Rank':>4}  {'Personal €':>12}  {'List €':>10}  {'ΔBonus':>8}  {'ΔPenalty':>9}  {'Year':>4}  {'km':>7}  Title"
    print(header)
    print("-" * len(header))

    for idx, item in enumerate(scored[: args.limit], start=1):
        personal = f"{item['personal_price']:,.0f}"
        price = f"{item['price']:,.0f}"
        bonus = f"-{item['bonus']:,.0f}" if item['bonus'] else "0"
        penalty = f"+{item['penalty']:,.0f}" if item['penalty'] else "0"
        mileage = f"{item['mileage']:,.0f}"
        title = item['title'] or item['trim'] or "(unknown)"
        print(
            f"{idx:>4}  {personal:>12}  {price:>10}  {bonus:>8}  {penalty:>9}  "
            f"{(item['year'] or '-')!s:>4}  {mileage:>7}  {title}"
        )
        print(f"      ↳ {item['url']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
