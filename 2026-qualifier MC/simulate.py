#!/usr/bin/env python3
# Monte Carlo Qualifier Simulator – Python
# All parameters come from qualifier_config.json
# ---------------------------------------------

import json, random, time
from pathlib import Path
from typing import Dict, List, Tuple, Literal, TypedDict, Any

# ---------------------------------------------------------------------------
# Load config
# ---------------------------------------------------------------------------

cfg_path = Path("qualifier_config.json")
cfg: Dict[str, Any] = json.loads(cfg_path.read_text())

NUM_SIMS: int      = cfg.get("numberOfSimulations", 1_000_000)
TEAMS: Tuple[str]  = tuple(cfg["teams"])              # type: ignore
RATING: Dict[str]  = cfg["elo"]                       # type: ignore
HOME_BONUS: int    = cfg["homeBonus"]
DRAW_R: float      = cfg["drawR"]
PLAYOFF_P: float   = cfg["playoffWinProb"]
INITIAL_POINTS     = cfg["currentPoints"]             # type: ignore
FIXTURES           = [tuple(f) for f in cfg["fixtures"]]  # type: ignore

Team = Literal["Austria", "Bosnia-Herzegovina", "Romania", "Cyprus", "San Marino"]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def elo_win(a: float, b: float) -> float:
    return 1 / (1 + 10 ** ((b - a) / 400))

def draw_prob(delta: float) -> float:
    w = 1 / (1 + 10 ** (-delta / 400))
    return 2 * w * (1 - w) * DRAW_R

def odds(home: Team, away: Team):
    delta = (RATING[home] + HOME_BONUS) - RATING[away]
    d = draw_prob(delta)
    h = (1 - d) * elo_win(RATING[home] + HOME_BONUS, RATING[away])
    return h, d, 1 - h - d

# ---------------------------------------------------------------------------
# Monte‑Carlo
# ---------------------------------------------------------------------------

class Tally(TypedDict): direct: int; playoff: int; fail: int

def simulate(n_sim: int = NUM_SIMS):
    tally: Dict[Team, Tally] = {t: {"direct": 0, "playoff": 0, "fail": 0} for t in TEAMS}

    for _ in range(n_sim):
        pts = INITIAL_POINTS.copy()

        for h, a in FIXTURES:
            p_home, p_draw, _ = odds(h, a)          # away prob = 1 - …
            r = random.random()
            if r < p_home:
                pts[h] += 3
            elif r < p_home + p_draw:
                pts[h] += 1; pts[a] += 1
            else:
                pts[a] += 3

        ranking = sorted(TEAMS, key=lambda t: (-pts[t], random.random()))
        tally[ranking[0]]["direct"] += 1
        tally[ranking[1]]["playoff"] += 1
        for t in ranking[2:]:
            tally[t]["fail"] += 1

    results: Dict[Team, Dict[str, float]] = {}
    for t in TEAMS:
        d = tally[t]["direct"] / n_sim
        p = tally[t]["playoff"] / n_sim
        f = tally[t]["fail"] / n_sim
        results[t] = {"direct": d, "playoff": p, "fail": f, "overall": d + p * PLAYOFF_P}
    return results

# ---------------------------------------------------------------------------
# Presentation
# ---------------------------------------------------------------------------

def pct(x: float) -> str: return f"{x*100:.1f}%"

def show_team_odds(res):
    hdr = ["Direct", "Playoff", "Eliminated", "Overall"]
    print(f"\nQualification probabilities ({NUM_SIMS:,} sims):\n")
    print(f"{'Team':<20} | " + " | ".join(f'{h:>10}' for h in hdr))
    print("-"*20 + "-+-" + "-+-".join("-"*10 for _ in hdr))
    for t in sorted(res, key=lambda x: res[x]["overall"], reverse=True):
        r = res[t]
        row = [pct(r[k]) for k in ("direct", "playoff", "fail", "overall")]
        print(f"{t:<20} | " + " | ".join(f"{v:>10}" for v in row))

def show_match_odds():
    hdr = ["Home Win", "Draw", "Away Win"]
    width = max(len(f"{h} vs {a}") for h,a in FIXTURES)
    print("\nOdds for each remaining fixture:\n")
    print(f"{'Match':<{width}} | " + " | ".join(f"{h:>10}" for h in hdr))
    print("-"*width + "-+-" + "-+-".join("-"*10 for _ in hdr))
    for h, a in FIXTURES:
        ph, pd, pa = odds(h, a)
        row = [pct(ph), pct(pd), pct(pa)]
        print(f"{h} vs {a:<{width-len(h)-4}} | " + " | ".join(f"{v:>10}" for v in row))

# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Starting Monte Carlo simulation...")
    t0 = time.perf_counter()
    results = simulate()
    print(f"Simulation time: {time.perf_counter() - t0:.3f}s")
    show_team_odds(results)
    show_match_odds()
