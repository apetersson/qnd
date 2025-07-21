// simulate.go
// Monte‑Carlo World‑Cup‑2026 qualifier simulator (UEFA Group H)
// Uses a single JSON file (qualifier_config.json) for **all** inputs:
//   • teams, Elo ratings, current table
//   • remaining fixtures
//   • model parameters (draw‑R, home bonus, playoff win prob)
//   • numberOfSimulations  ← NEW
//
// Build / run:
//   go run simulate.go
// ---------------------------------------------------------------------------

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"os"
	"text/tabwriter"
	"time"
)

/* -------------------------------------------------------------------------
   Config loader
-------------------------------------------------------------------------- */

type Config struct {
	NumberOfSimulations int                `json:"numberOfSimulations"`
	Teams               []string           `json:"teams"`
	Elo                 map[string]float64 `json:"elo"`
	HomeBonus           float64            `json:"homeBonus"`
	CurrentPoints       map[string]int     `json:"currentPoints"`
	Fixtures            [][2]string        `json:"fixtures"`
	DrawR               float64            `json:"drawR"`
	PlayoffWinProb      float64            `json:"playoffWinProb"`
}

func loadConfig() Config {
	raw, err := os.ReadFile("qualifier_config.json")
	if err != nil {
		log.Fatalf("can’t read qualifier_config.json: %v", err)
	}
	var c Config
	if err := json.Unmarshal(raw, &c); err != nil {
		log.Fatalf("bad JSON: %v", err)
	}
	if c.NumberOfSimulations <= 0 {
		c.NumberOfSimulations = 1_000_000
	}
	return c
}

var cfg = loadConfig()

/* -------------------------------------------------------------------------
   Probability helpers
-------------------------------------------------------------------------- */

func eloWin(a, b float64) float64 { return 1 / (1 + math.Pow(10, (b-a)/400)) }

func drawProb(delta float64) float64 {
	w := 1 / (1 + math.Pow(10, -delta/400))
	return 2 * w * (1 - w) * cfg.DrawR
}

func matchOdds(home, away string) (pHome, pDraw, pAway float64) {
	delta := cfg.Elo[home] + cfg.HomeBonus - cfg.Elo[away]
	pDraw = drawProb(delta)
	pHome = (1 - pDraw) * eloWin(cfg.Elo[home]+cfg.HomeBonus, cfg.Elo[away])
	pAway = 1 - pHome - pDraw
	return
}

/* -------------------------------------------------------------------------
   Simulation
-------------------------------------------------------------------------- */

type tallies struct{ direct, playoff, fail int64 }

func simulate() map[string]tallies {
	count := map[string]tallies{}
	for _, t := range cfg.Teams {
		count[t] = tallies{}
	}

	for s := 0; s < cfg.NumberOfSimulations; s++ {
		pts := make(map[string]int, len(cfg.Teams))
		for k, v := range cfg.CurrentPoints {
			pts[k] = v
		}

		for _, f := range cfg.Fixtures {
			h, a := f[0], f[1]
			pHome, pDraw, _ := matchOdds(h, a)
			r := rand.Float64()
			switch {
			case r < pHome:
				pts[h] += 3
			case r < pHome+pDraw:
				pts[h]++
				pts[a]++
			default:
				pts[a] += 3
			}
		}

		// rank with random tie‑break
		best, second := "", ""
		for _, t := range cfg.Teams {
			if best == "" || pts[t] > pts[best] || (pts[t] == pts[best] && rand.Float64() < 0.5) {
				second = best
				best = t
			} else if second == "" || pts[t] > pts[second] || (pts[t] == pts[second] && rand.Float64() < 0.5) {
				second = t
			}
		}

		c := count[best]
		c.direct++
		count[best] = c
		c = count[second]
		c.playoff++
		count[second] = c
		for _, t := range cfg.Teams {
			if t != best && t != second {
				c := count[t]
				c.fail++
				count[t] = c
			}
		}
	}
	return count
}

/* -------------------------------------------------------------------------
   Pretty print helpers
-------------------------------------------------------------------------- */

func pct(x float64) string { return fmt.Sprintf("%.1f%%", x*100) }

/* -------------------------------------------------------------------------
   Main
-------------------------------------------------------------------------- */

func main() {
	rand.Seed(time.Now().UnixNano())
	start := time.Now()

	count := simulate()
	elapsed := time.Since(start)
	fmt.Printf("Simulation time: %v (%d simulations)\n\n", elapsed, cfg.NumberOfSimulations)

	// Table 1 – qualification probabilities
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 1, ' ', 0)
	fmt.Fprintln(w, "Team\tDirect\tPlayoff\tEliminated\tOverall")
	for _, t := range cfg.Teams {
		c := count[t]
		d := float64(c.direct) / float64(cfg.NumberOfSimulations)
		p := float64(c.playoff) / float64(cfg.NumberOfSimulations)
		f := float64(c.fail) / float64(cfg.NumberOfSimulations)
		overall := d + p*cfg.PlayoffWinProb
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n",
			t, pct(d), pct(p), pct(f), pct(overall))
	}
	w.Flush()
	fmt.Println()

	// Table 2 – per‑fixture odds
	w2 := tabwriter.NewWriter(os.Stdout, 0, 0, 1, ' ', 0)
	fmt.Fprintln(w2, "Match\tHome Win\tDraw\tAway Win")
	for _, f := range cfg.Fixtures {
		h, a := f[0], f[1]
		ph, pd, pa := matchOdds(h, a)
		fmt.Fprintf(w2, "%s vs %s\t%s\t%s\t%s\n",
			h, a, pct(ph), pct(pd), pct(pa))
	}
	w2.Flush()
}
