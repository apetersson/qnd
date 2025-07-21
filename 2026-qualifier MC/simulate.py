#!/usr/bin/env python3
# Monte Carlo Qualifier Simulator – Python
# All parameters come from qualifier_config.json
# ---------------------------------------------

import json, random, time, sys
from pathlib import Path
from typing import Dict, List, Tuple, Literal, TypedDict, Any

# ---------------------------------------------------------------------------
# Load config
# ---------------------------------------------------------------------------

if len(sys.argv) > 1:
    cfg_path = Path(sys.argv[1])
else:
    cfg_path = Path("groupH.json") # Default to groupH.json

cfg: Dict[str, Any] = json.loads(cfg_path.read_text())

NUM_SIMS: int      = cfg.get("numberOfSimulations", 1_000_000)
TEAMS: Tuple[str]  = tuple(cfg["teams"])              # type: ignore
RATING: Dict[str, float]  = cfg["elo"]                       # type: ignore
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

# ---------------------------------------------------------------------------
# Pre-computation
# ---------------------------------------------------------------------------

TEAM_IDX   = {t: i for i, t in enumerate(TEAMS)}
BASE_PTS   = [INITIAL_POINTS[t] for t in TEAMS]

FIX = []
for h, a in FIXTURES:
    delta = (RATING[h] + HOME_BONUS) - RATING[a]
    d = draw_prob(delta)
    _h = (1 - d) * elo_win(RATING[h] + HOME_BONUS, RATING[a])
    FIX.append((TEAM_IDX[h], TEAM_IDX[a], _h, d, 1 - _h - d)) # h_idx, a_idx, p_home, p_draw, p_away

# ---------------------------------------------------------------------------
# Monte‑Carlo
# ---------------------------------------------------------------------------

class Tally(TypedDict): direct: int; playoff: int; fail: int

def simulate(n_sim: int = NUM_SIMS):
    tally: Dict[Team, Tally] = {t: {"direct": 0, "playoff": 0, "fail": 0} for t in TEAMS}

    for _ in range(n_sim):
        pts = BASE_PTS.copy() # Use pre-computed base points

        for hi, ai, pH, pD, _ in FIX: # Iterate through pre-computed fixtures
            r = random.random()
            if r < pH:
                pts[hi] += 3
            elif r < pH + pD:
                pts[hi] += 1; pts[ai] += 1
            else:
                pts[ai] += 3

        # Optimized ranking: avoid dict lookups and string comparisons in hot loop
        # Create a list of (points, random_tiebreaker, team_index) tuples
        team_scores = []
        for i, p in enumerate(pts):
            team_scores.append((-p, random.random(), i)) # Negative points for descending sort

        # Sort based on points and tie-breaker
        team_scores.sort()

        # Update tally using original team names
        tally[TEAMS[team_scores[0][2]]]["direct"] += 1
        tally[TEAMS[team_scores[1][2]]]["playoff"] += 1
        for i in range(2, len(team_scores)):
            tally[TEAMS[team_scores[i][2]]]["fail"] += 1

    results: Dict[Team, Dict[str, float]] = {}
    for i, t in enumerate(TEAMS): # Iterate using index for direct access
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
    width = max(len(f"{TEAMS[int(h_idx)]} vs {TEAMS[int(a_idx)]}") for h_idx, a_idx, _, _, _ in FIX)
    print("\nOdds for each remaining fixture:\n")
    print(f"{'Match':<{width}} | " + " | ".join(f"{h:>10}" for h in hdr))
    print("-" * width + "-+-" + "-+" + "-".join("-" * 10 for _ in hdr))
    for h_idx, a_idx, ph, pd, pa in FIX:
        row = [pct(ph), pct(pd), pct(pa)]
        print(f"{TEAMS[int(h_idx)]} vs {TEAMS[int(a_idx)]:<{width-len(TEAMS[int(h_idx)])-4}} | " + " | ".join(f"{v:>10}" for v in row))

# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Starting Monte Carlo simulation...")
    t0 = time.perf_counter()
    results = simulate()
    print(f"Simulation time: {time.perf_counter() - t0:.3f}s ({NUM_SIMS:,} simulations)")
    show_team_odds(results)
    show_match_odds()
