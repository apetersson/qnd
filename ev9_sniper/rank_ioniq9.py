#!/usr/bin/env python3
"""Rank Hyundai Ioniq 9 listings using the shared ranker but with Ioniq 9 defaults.

Usage examples:
  python qnd/ev9_sniper/rank_ioniq9.py
  python qnd/ev9_sniper/rank_ioniq9.py --limit 30
  python qnd/ev9_sniper/rank_ioniq9.py --preferences qnd/ev9_sniper/preferences_ioniq9.yaml
  python qnd/ev9_sniper/rank_ioniq9.py --path 'gebrauchtwagen/auto/hyundai-gebrauchtwagen/ioniq-9'
"""
from __future__ import annotations

import sys
from typing import List

import rank_ev9 as shared

DEFAULT_PREF = "preferences_ioniq9.yaml"
DEFAULT_PATH = "gebrauchtwagen/auto/hyundai-gebrauchtwagen/ioniq-9"


def ensure_flag(argv: List[str], flag: str, value: str) -> List[str]:
    if flag in argv:
        return argv
    return argv + [flag, value]


def main() -> int:
    argv = sys.argv[1:]
    argv = ensure_flag(argv, "--preferences", DEFAULT_PREF)
    argv = ensure_flag(argv, "--path", DEFAULT_PATH)

    # Patch shared.main() arg parsing by simulating command-line
    old_argv = sys.argv
    try:
        sys.argv = [old_argv[0]] + argv
        return shared.main()
    finally:
        sys.argv = old_argv


if __name__ == "__main__":
    raise SystemExit(main())
