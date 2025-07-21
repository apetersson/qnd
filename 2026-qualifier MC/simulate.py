import random

def monte_carlo_qualification(
        n_sim: int = 100_000,
        playoff_win_prob: float = 0.50,
        seed: int = 42
) -> dict[str, float]:
    """
    Quick‑n‑dirty World‑Cup‑2026 qualification simulator for Austria (UEFA Group H).

    Returns a dict with the probabilities of:
      • direct  – winning the group
      • playoff – finishing 2nd (before the playoff itself)
      • fail    – 3rd or worse
      • overall – direct + playoff * playoff_win_prob
    """

    random.seed(seed)

    teams = ["Austria", "Bosnia", "Romania", "Cyprus", "San Marino"]

    # Elo‑style “common‑sense” ratings
    rating = {
        "Austria":     1900,
        "Bosnia":      1750,
        "Romania":     1700,
        "Cyprus":      1450,
        "San Marino":  1050,
    }

    HOME_BONUS = 100.0       # home‑field edge in Elo points
    DRAW_P      = 0.25       # flat draw probability

    direct = playoff = fail = 0

    for _ in range(n_sim):
        pts = {t: 0 for t in teams}

        # double round‑robin: each pair meets home & away
        for i in range(len(teams)):
            for j in range(i + 1, len(teams)):
                t1, t2 = teams[i], teams[j]

                for home, away in [(t1, t2), (t2, t1)]:
                    # Elo‑style win expectation for the home side
                    d          = (rating[home] + HOME_BONUS) - rating[away]
                    win_expect = 1 / (1 + 10 ** (-d / 400))

                    p_home_win = (1 - DRAW_P) * win_expect
                    p_away_win = (1 - DRAW_P) * (1 - win_expect)

                    r = random.random()
                    if r < p_home_win:              # home win
                        pts[home] += 3
                    elif r < p_home_win + DRAW_P:   # draw
                        pts[home] += 1
                        pts[away] += 1
                    else:                           # away win
                        pts[away] += 3

        # rank by points (random tiebreaker if needed)
        table = sorted(teams, key=lambda t: (pts[t], random.random()), reverse=True)
        pos   = table.index("Austria") + 1

        if pos == 1:
            direct += 1
        elif pos == 2:
            playoff += 1
        else:
            fail += 1

    direct_p  = direct  / n_sim
    playoff_p = playoff / n_sim
    overall_p = direct_p + playoff_p * playoff_win_prob

    return {
        "direct":  direct_p,
        "playoff": playoff_p,
        "fail":    fail / n_sim,
        "overall": overall_p,
    }

# Example run
if __name__ == "__main__":
    print(monte_carlo_qualification())
import random

def monte_carlo_qualification(
        n_sim: int = 100_000,
        playoff_win_prob: float = 0.50,
        seed: int = 42
) -> dict[str, float]:
    """
    Quick‑n‑dirty World‑Cup‑2026 qualification simulator for Austria (UEFA Group H).

    Returns a dict with the probabilities of:
      • direct  – winning the group
      • playoff – finishing 2nd (before the playoff itself)
      • fail    – 3rd or worse
      • overall – direct + playoff * playoff_win_prob
    """

    random.seed(seed)

    teams = ["Austria", "Bosnia", "Romania", "Cyprus", "San Marino"]

    # Elo‑style “common‑sense” ratings
    rating = {
        "Austria":     1800,
        "Bosnia":      1750,
        "Romania":     1700,
        "Cyprus":      1450,
        "San Marino":  1050,
    }

    HOME_BONUS = 100.0       # home‑field edge in Elo points
    DRAW_P      = 0.25       # flat draw probability

    direct = playoff = fail = 0

    for _ in range(n_sim):
        pts = {t: 0 for t in teams}

        # double round‑robin: each pair meets home & away
        for i in range(len(teams)):
            for j in range(i + 1, len(teams)):
                t1, t2 = teams[i], teams[j]

                for home, away in [(t1, t2), (t2, t1)]:
                    # Elo‑style win expectation for the home side
                    d          = (rating[home] + HOME_BONUS) - rating[away]
                    win_expect = 1 / (1 + 10 ** (-d / 400))

                    p_home_win = (1 - DRAW_P) * win_expect
                    p_away_win = (1 - DRAW_P) * (1 - win_expect)

                    r = random.random()
                    if r < p_home_win:              # home win
                        pts[home] += 3
                    elif r < p_home_win + DRAW_P:   # draw
                        pts[home] += 1
                        pts[away] += 1
                    else:                           # away win
                        pts[away] += 3

        # rank by points (random tiebreaker if needed)
        table = sorted(teams, key=lambda t: (pts[t], random.random()), reverse=True)
        pos   = table.index("Austria") + 1

        if pos == 1:
            direct += 1
        elif pos == 2:
            playoff += 1
        else:
            fail += 1

    direct_p  = direct  / n_sim
    playoff_p = playoff / n_sim
    overall_p = direct_p + playoff_p * playoff_win_prob

    return {
        "direct":  direct_p,
        "playoff": playoff_p,
        "fail":    fail / n_sim,
        "overall": overall_p,
    }

# Example run
if __name__ == "__main__":
    print(monte_carlo_qualification())
