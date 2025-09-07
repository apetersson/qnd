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
	"flag"
	"fmt"
	"log"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"text/tabwriter"
	"time"

	yaml "gopkg.in/yaml.v2"
)

/* -------------------------------------------------------------------------
   Config loader
-------------------------------------------------------------------------- */

var prngChoice = flag.String("prng", "xorshift32", "PRNG to use: 'math' or 'xorshift32'")

type Config struct {
	NumberOfSimulations int                `json:"numberOfSimulations" yaml:"numberOfSimulations"`
	Teams               []string           `json:"teams" yaml:"teams"`
	Elo                 map[string]float64 `json:"elo" yaml:"elo"`
	HomeBonus           float64            `json:"homeBonus" yaml:"homeBonus"`
	CurrentPoints       map[string]int     `json:"currentPoints" yaml:"currentPoints"`
	Fixtures            [][2]string        `json:"fixtures" yaml:"fixtures"`
	DrawR               float64            `json:"drawR" yaml:"drawR"`
	PlayoffWinProb      float64            `json:"playoffWinProb" yaml:"playoffWinProb"`

	// Precomputed data
	TeamIdx             map[string]int
	BasePts             []int
	PrecomputedFixtures [][5]float64 // home_idx, away_idx, p_home, p_draw, p_away
}

func loadConfig() Config {
	flag.Parse()
	cfgPath := flag.Arg(0)
	if cfgPath == "" {
		cfgPath = "groupH.json"
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

	if len(c.Teams) == 0 {
		log.Fatalf("config error: 'teams' cannot be empty")
	}
	if len(c.Elo) == 0 {
		log.Fatalf("config error: 'elo' cannot be empty")
	}
	if c.HomeBonus == 0 {
		log.Fatalf("config error: 'homeBonus' cannot be zero")
	}
	if len(c.CurrentPoints) == 0 {
		log.Fatalf("config error: 'currentPoints' cannot be empty")
	}
	if len(c.Fixtures) == 0 {
		log.Fatalf("config error: 'fixtures' cannot be empty")
	}
	if c.DrawR == 0 {
		log.Fatalf("config error: 'drawR' cannot be zero")
	}
	if c.PlayoffWinProb == 0 {
		log.Fatalf("config error: 'playoffWinProb' cannot be zero")
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

// PRNG interface
type prng interface {
	nextFloat64() float64
}

// xorshift32 PRNG
type xorshift32 struct {
	state uint32
}

func newXorshift32(seed int64) *xorshift32 {
	return &xorshift32{state: uint32(seed)}
}

func (r *xorshift32) nextFloat64() float64 {
	r.state ^= r.state << 13
	r.state ^= r.state >> 17
	r.state ^= r.state << 5
	return float64(r.state) / 4294967296.0
}

// Wrapper for math/rand to satisfy the prng interface
type mathRand struct {
	*rand.Rand
}

func (r *mathRand) nextFloat64() float64 {
	return r.Float64()
}

func simulate() []tallies {
	numWorkers := runtime.NumCPU()
	simsPerWorker := cfg.NumberOfSimulations / numWorkers
	remainingSims := cfg.NumberOfSimulations % numWorkers
	resultsChan := make(chan []tallies, numWorkers)
	var wg sync.WaitGroup

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			localCounts := make([]tallies, len(cfg.Teams))

			var r prng
			seed := time.Now().UnixNano() + int64(workerID)
			if *prngChoice == "math" {
				r = &mathRand{rand.New(rand.NewSource(seed))}
			} else {
				r = newXorshift32(seed)
			}

			pts := make([]int, len(cfg.Teams))

			numSims := simsPerWorker
			if workerID < remainingSims {
				numSims++
			}

			for s := 0; s < numSims; s++ {
				copy(pts, cfg.BasePts)

				for _, f := range cfg.PrecomputedFixtures {
					homeIdx, awayIdx := int(f[0]), int(f[1])
					pHome, pDraw := f[2], f[3]
					randVal := r.nextFloat64()
					if randVal < pHome {
						pts[homeIdx] += 3
					} else if randVal < pHome+pDraw {
						pts[homeIdx]++
						pts[awayIdx]++
					} else {
						pts[awayIdx] += 3
					}
				}

				first, second := 0, 1
				if pts[1] > pts[0] || (pts[1] == pts[0] && r.nextFloat64() < 0.5) {
					first, second = 1, 0
				}
				for i := 2; i < len(cfg.Teams); i++ {
					if pts[i] > pts[first] || (pts[i] == pts[first] && r.nextFloat64() < 0.5) {
						second = first
						first = i
					} else if pts[i] > pts[second] || (pts[i] == pts[second] && r.nextFloat64() < 0.5) {
						second = i
					}
				}

				localCounts[first].direct++
				localCounts[second].playoff++
				for i := 0; i < len(cfg.Teams); i++ {
					if i != first && i != second {
						localCounts[i].fail++
					}
				}
			}
			resultsChan <- localCounts
		}(i)
	}

	wg.Wait()
	close(resultsChan)

	finalCounts := make([]tallies, len(cfg.Teams))
	for workerResult := range resultsChan {
		for i, counts := range workerResult {
			finalCounts[i].direct += counts.direct
			finalCounts[i].playoff += counts.playoff
			finalCounts[i].fail += counts.fail
		}
	}

	return finalCounts
}

/* -------------------------------------------------------------------------
   Pretty print helpers
-------------------------------------------------------------------------- */

func pct(x float64) string { return fmt.Sprintf("%.1f%%", x*100) }

/* -------------------------------------------------------------------------
   Main
-------------------------------------------------------------------------- */

func main() {
	start := time.Now()

	count := simulate()
	elapsed := time.Since(start)
	fmt.Printf("Simulation time: %v (%d simulations)\n\n", elapsed, cfg.NumberOfSimulations)

	// Table 1 – qualification probabilities
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 1, ' ', 0)
	fmt.Fprintln(w, "Team\tDirect\tPlayoff\tEliminated\tOverall")
	for i, t := range cfg.Teams {
		c := count[i]
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
