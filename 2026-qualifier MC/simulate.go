// simulate.go
// Monte‑Carlo World‑Cup‑2026 qualifier simulator (UEFA Group H)
// Uses a single JSON file (groupH.json) for **all** inputs:
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
	"path/filepath"
	"sort"
	"text/tabwriter"
	"time"

	yaml "gopkg.in/yaml.v2"
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

	// Precomputed data
	TeamIdx             map[string]int
	BasePts             []int
	PrecomputedFixtures [][5]float64 // home_idx, away_idx, p_home, p_draw, p_away
}

func loadConfig() Config {
	cfgPath := "groupH.json" // Default config file
	if len(os.Args) > 1 {
		cfgPath = os.Args[1]
	}

	raw, err := os.ReadFile(cfgPath)
	if err != nil {
		log.Fatalf("can’t read %s: %v", cfgPath, err)
	}
	var c Config

	ext := filepath.Ext(cfgPath)
	switch ext {
	case ".json":
		if err := json.Unmarshal(raw, &c); err != nil {
			log.Fatalf("bad JSON: %v", err)
		}
	case ".yaml", ".yml":
		if err := yaml.Unmarshal(raw, &c); err != nil {
			log.Fatalf("bad YAML: %v", err)
		}
	default:
		log.Fatalf("unsupported config file format: %s", ext)
	}

	if c.NumberOfSimulations <= 0 {
		c.NumberOfSimulations = 1_000_000
	}

	// Precompute team indices and base points
	c.TeamIdx = make(map[string]int, len(c.Teams))
	c.BasePts = make([]int, len(c.Teams))
	for i, team := range c.Teams {
		c.TeamIdx[team] = i
		c.BasePts[i] = c.CurrentPoints[team]
	}

	// Precompute fixture odds with integer indices
	c.PrecomputedFixtures = make([][5]float64, len(c.Fixtures))
	for i, f := range c.Fixtures {
		home, away := f[0], f[1]
		homeIdx, awayIdx := c.TeamIdx[home], c.TeamIdx[away]

		delta := c.Elo[home] + c.HomeBonus - c.Elo[away]
		pDraw := c.drawProb(delta)
		pHome := (1 - pDraw) * eloWin(c.Elo[home]+c.HomeBonus, c.Elo[away])
		pAway := 1 - pHome - pDraw

		c.PrecomputedFixtures[i] = [5]float64{float64(homeIdx), float64(awayIdx), pHome, pDraw, pAway}
	}

	return c
}

var cfg = loadConfig()

/* -------------------------------------------------------------------------
   Probability helpers
-------------------------------------------------------------------------- */

func eloWin(a, b float64) float64 { return 1 / (1 + math.Pow(10, (b-a)/400)) }

func (c *Config) drawProb(delta float64) float64 {
	w := 1 / (1 + math.Pow(10, -delta/400))
	return 2 * w * (1 - w) * c.DrawR
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
		pts := make([]int, len(cfg.Teams))
		copy(pts, cfg.BasePts)

		for _, f := range cfg.PrecomputedFixtures {
			homeIdx, awayIdx := int(f[0]), int(f[1])
			pHome, pDraw := f[2], f[3]
			r := rand.Float64()
			switch {
			case r < pHome:
				pts[homeIdx] += 3
			case r < pHome+pDraw:
				pts[homeIdx]++
				pts[awayIdx]++
			default:
				pts[awayIdx] += 3
			}
		}

		// Optimized ranking: avoid map lookups and string comparisons in hot loop
		// Create a slice of (points, random_tiebreaker, team_index) tuples
		type teamScore struct {
			points     int
			tiebreaker float64
			index      int
		}
		teamScores := make([]teamScore, len(cfg.Teams))
		for i, p := range pts {
			teamScores[i] = teamScore{points: p, tiebreaker: rand.Float64(), index: i}
		}

		// Sort based on points (descending) and tie-breaker (ascending)
		sort.Slice(teamScores, func(i, j int) bool {
			if teamScores[i].points != teamScores[j].points {
				return teamScores[i].points > teamScores[j].points
			}
			return teamScores[i].tiebreaker < teamScores[j].tiebreaker
		})

		// Update tally using original team names
		c := count[cfg.Teams[teamScores[0].index]]
		c.direct++
		count[cfg.Teams[teamScores[0].index]] = c

		c = count[cfg.Teams[teamScores[1].index]]
		c.playoff++
		count[cfg.Teams[teamScores[1].index]] = c

		for i := 2; i < len(teamScores); i++ {
			c = count[cfg.Teams[teamScores[i].index]]
			c.fail++
			count[cfg.Teams[teamScores[i].index]] = c
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
	fmt.Fprintln(w2, "Match\tHome Win\tDraw\tAway Win")
	for _, f := range cfg.PrecomputedFixtures {
		homeIdx, awayIdx := int(f[0]), int(f[1])
		pHome, pDraw, pAway := f[2], f[3], f[4]
		fmt.Fprintf(w2, "%s vs %s\t%s\t%s\t%s\n",
			cfg.Teams[homeIdx], cfg.Teams[awayIdx], pct(pHome), pct(pDraw), pct(pAway))
	}
	w2.Flush()
}
