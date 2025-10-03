#!/usr/bin/env python3
"""Rank EV9 listings using personal value weights from preferences.yaml."""
from __future__ import annotations

import argparse
import math
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set

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


def _collect_text(flat: Dict[str, Any]) -> str:
    parts = [
        str(flat.get("CAR_MODEL/MODEL_SPECIFICATION", "")),
        str(flat.get("HEADING", "")),
        str(flat.get("DESCRIPTION", "")),
        str(flat.get("BODY_DYN", "")),
        str(flat.get("ADDITIONAL_INFO", "")),
    ]
    return " ".join(filter(None, parts)).strip()


def determine_drivetrain(flat: Dict[str, Any]) -> str:
    """Return RWD, AWD, PERF_AWD or Unk based on listing text."""
    text = _collect_text(flat).lower()
    if any(k in text for k in ("performance", "509ps", "509 ps")):
        # Treat explicit performance cues as performance AWD
        return "PERF_AWD"
    if "awd" in text or "4wd" in text or "allrad" in text:
        return "AWD"
    if "rwd" in text or "2wd" in text:
        return "RWD"
    return "Unk"


def determine_drivetrain_with_pref(flat: Dict[str, Any], pref: Dict[str, Any]) -> str:
    """Use trim aliases to improve PERF_AWD detection."""
    trim = detect_trim(flat, pref) or ""
    if trim == "GT/Performance":
        return "PERF_AWD"
    return determine_drivetrain(flat)


def detect_trim(flat: Dict[str, Any], pref: Dict[str, Any]) -> Optional[str]:
    """Normalise trim name using trim_aliases from preferences."""
    text = _collect_text(flat).lower()
    aliases: Dict[str, Any] = pref.get("trim_aliases", {})
    for canonical, keys in aliases.items():
        for key in keys:
            if key.lower() in text:
                return canonical
    # Fall back to spec field if present
    raw = str(flat.get("CAR_MODEL/MODEL_SPECIFICATION") or "").strip()
    return raw or None


def _features_catalog(pref: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    feats = pref.get("features", {}) or {}
    # ensure structure
    return {k: (v or {}) for k, v in feats.items()}


def trim_included_features(trim: Optional[str], pref: Dict[str, Any]) -> Set[str]:
    includes_cfg: Dict[str, Any] = pref.get("trim_includes", {}) or {}
    if not trim:
        return set()
    entry = includes_cfg.get(trim)
    if not entry:
        return set()
    # includes_all means all features in catalog are present
    if isinstance(entry, dict) and entry.get("includes_all"):
        return set(_features_catalog(pref).keys())
    # else expect a list under key 'includes' or a bare list
    if isinstance(entry, dict):
        values = entry.get("includes", [])
    else:
        values = entry
    return set(str(x) for x in (values or []))


def detect_present_features(flat: Dict[str, Any], pref: Dict[str, Any]) -> Set[str]:
    """Union of trim-included features and keyword-detected features."""
    text = _collect_text(flat).lower()
    feats = _features_catalog(pref)
    present: Set[str] = set()
    trim = detect_trim(flat, pref)
    present |= trim_included_features(trim, pref)
    for key, meta in feats.items():
        for kw in meta.get("keywords", []) or []:
            if str(kw).lower() in text:
                present.add(key)
                break
    return present


def color_bonus(flat: Dict[str, Any], pref: Dict[str, Any]) -> float:
    colors: Dict[str, Any] = pref.get("color_bonus", {}) or {}
    aliases: Dict[str, str] = pref.get("color_aliases", {}) or {}
    if not colors:
        return 0.0
    raw_candidates = [
        str(flat.get("COLOUR", "")),
        str(flat.get("COLOR", "")),
        str(flat.get("PAINT", "")),
        _collect_text(flat),
    ]
    raw = " ".join(filter(None, raw_candidates)).lower()
    # try alias matches first
    for alias, norm in aliases.items():
        if alias.lower() in raw and norm in colors:
            return float(colors[norm])
    # then try direct keys
    for norm in colors:
        if norm.lower() in raw:
            return float(colors[norm])
    return 0.0


def seat_bonus(flat: Dict[str, Any], pref: Dict[str, Any]) -> float:
    mapping: Dict[str, Any] = pref.get("seat_bonus", {}) or {}
    if not mapping:
        return 0.0
    seats = flat.get("NOOFSEATS") or flat.get("seats")
    if seats:
        val = mapping.get(str(seats))
        if val is not None:
            return float(val)
    # default by trim
    defaults: Dict[str, Any] = pref.get("seat_defaults_by_trim", {}) or {}
    trim = detect_trim(flat, pref)
    if trim and str(defaults.get(trim)) in mapping:
        return float(mapping[str(defaults[trim])])
    # attempt to parse from text
    text = _collect_text(flat).lower()
    if "6 sitz" in text or "6-sitz" in text or "6-sitzer" in text:
        val = mapping.get("6")
        return float(val) if val is not None else 0.0
    if "7 sitz" in text or "7-sitz" in text or "7-sitzer" in text:
        val = mapping.get("7")
        return float(val) if val is not None else 0.0
    return 0.0


def trim_bonus(flat: Dict[str, Any], pref: Dict[str, Any]) -> float:
    trim_map: Dict[str, Any] = pref.get("trim_bonus", {})
    trim = detect_trim(flat, pref)
    if trim and trim in trim_map:
        return float(trim_map[trim])
    return float(trim_map.get("default", 0))


def option_bonus(flat: Dict[str, Any], pref: Dict[str, Any]) -> float:
    keywords: Dict[str, Any] = pref.get("option_keywords", {})
    text = _collect_text(flat).lower()
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
    drivetrain = determine_drivetrain_with_pref(flat, pref)
    return float(mapping.get(drivetrain, mapping.get("default", 0)))


def features_bonus(flat: Dict[str, Any], pref: Dict[str, Any]) -> float:
    feats = _features_catalog(pref)
    present = detect_present_features(flat, pref)
    total = 0.0
    for key in present:
        if key in feats:
            try:
                total += float(feats[key].get("value", 0))
            except (TypeError, ValueError):
                pass
    return total


def compute_personal_value(flat: Dict[str, Any], pref: Dict[str, Any]) -> Dict[str, Any]:
    try:
        price = float(flat.get("PRICE") or flat.get("PRICE/AMOUNT") or 0.0)
    except (TypeError, ValueError):
        price = 0.0

    bonus_total = 0.0
    bonus_total += drivetrain_bonus(flat, pref)
    bonus_total += trim_bonus(flat, pref)
    bonus_total += features_bonus(flat, pref)
    bonus_total += color_bonus(flat, pref)
    bonus_total += seat_bonus(flat, pref)
    bonus_total += option_bonus(flat, pref)
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
        "drivetrain": determine_drivetrain_with_pref(flat, pref),
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
