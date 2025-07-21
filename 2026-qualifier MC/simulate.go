package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math"
	"math/rand"
	"os"
	"text/tabwriter"
	"time"
)

/* -----------------------------------------------------------------------
   Data
----------------------------------------------------------------------- */

var teams = []string{
	"Austria", "Bosnia-Herzegovina", "Romania", "Cyprus", "San Marino",
}

// Elo ratings 21	Jul	2025
var rating = map[string]float64{
	"Austria":            2101,
	"Bosnia-Herzegovina": 1853,
	"Romania":            1990,
	"Cyprus":             2018,
	"San Marino":         1326,
}

var points0 = map[string]int{
	"Bosnia-Herzegovina": 9,
	"Austria":            6,
	"Romania":            6,
	"Cyprus":             3,
	"San Marino":         0,
}

// remaining fixtures
var fixtures = [][2]string{
	{"Austria", "Cyprus"}, {"San Marino", "Bosnia-Herzegovina"},
	{"Bosnia-Herzegovina", "Austria"}, {"Cyprus", "Romania"},
	{"Austria", "San Marino"}, {"Cyprus", "Bosnia-Herzegovina"},
	{"San Marino", "Cyprus"}, {"Romania", "Austria"},
	{"Cyprus", "Austria"}, {"Bosnia-Herzegovina", "Romania"},
	{"Austria", "Bosnia-Herzegovina"}, {"Romania", "San Marino"},
}

/* -----------------------------------------------------------------------
   Parameters
----------------------------------------------------------------------- */

type Config struct {
	NumberOfSimulations int     `json:"numberOfSimulations"`
	HomeBonus           float64 `json:"homeBonus"`
	DrawR               float64 `json:"drawR"`
	PlayoffWinProb      float64 `json:"playoffWinProb"`
}

var config Config

func init() {
	file, err := ioutil.ReadFile("qualifier_config.json")
	if err != nil {
		fmt.Printf("Error reading config file: %v\n", err)
		os.Exit(1)
	}

	err = json.Unmarshal(file, &config)
	if err != nil {
		fmt.Printf("Error parsing config file: %v\n", err)
		os.Exit(1)
	}
}

const homeBonus = 10.0
const rDraw = 0.4
const playoffWinProb = 0.5

/* -----------------------------------------------------------------------
   Probabilities
----------------------------------------------------------------------- */

func elo(a, b float64) float64 { return 1 / (1 + math.Pow(10, (b-a)/400)) }

func draw(delta float64) float64 {
	w := 1 / (1 + math.Pow(10, -delta/400))
	return 2 * w * (1 - w) * rDraw
}

type result struct{ direct, playoff, fail float64 }

func matchOdds(home, away string) (pHome, pDraw, pAway float64) {
	delta := rating[home] + homeBonus - rating[away]
	pDraw = draw(delta)
	pHome = (1 - pDraw) * elo(rating[home]+homeBonus, rating[away])
	pAway = 1 - pHome - pDraw
	return
}

/* -----------------------------------------------------------------------
   Main
----------------------------------------------------------------------- */

func main() {
	rand.Seed(time.Now().UnixNano())
	start := time.Now()

	// tallies
	count := map[string]result{}
	for _, t := range teams {
		count[t] = result{}
	}

	for s := 0; s < config.NumberOfSimulations; s++ {
		pts := map[string]int{}
		for k, v := range points0 {
			pts[k] = v
		}

		for _, f := range fixtures {
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

		// rank (random tie	break)
		best, second := "", ""
		for _, t := range teams {
			if best == "" ||
				pts[t] > pts[best] ||
				(pts[t] == pts[best] && rand.Float64() < 0.5) {
				second = best
				best = t
			} else if second == "" ||
				pts[t] > pts[second] ||
				(pts[t] == pts[second] && rand.Float64() < 0.5) {
				second = t
			}
		}

		b := count[best]
		b.direct++
		count[best] = b

		sn := count[second]
		sn.playoff++
		count[second] = sn

		for _, t := range teams {
			if t != best && t != second {
				c := count[t]
				c.fail++
				count[t] = c
			}
		}
	}

	// timing
	fmt.Printf("Simulation time: %v\n\n", time.Since(start))

	/* -------------------------------------------------------------------
	   Table	1	– qualification probabilities
	------------------------------------------------------------------- */
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 1, ' ', 0)
	fmt.Fprintln(w, "Team\tDirect\tPlayoff\tEliminated\tOverall")
	for _, t := range teams {
		r := count[t]
		d := r.direct / float64(config.NumberOfSimulations)
		p := r.playoff / float64(config.NumberOfSimulations)
		f := r.fail / float64(config.NumberOfSimulations)
		overall := d + p*config.PlayoffWinProb
		fmt.Fprintf(w, "%s\t%.1f%%\t%.1f%%\t%.1f%%\t%.1f%%\n",
			t, d*100, p*100, f*100, overall*100)
	}
	w.Flush()
	fmt.Println()

	/* -------------------------------------------------------------------
	   Table	2	– odds for remaining fixtures
	------------------------------------------------------------------- */
	w2 := tabwriter.NewWriter(os.Stdout, 0, 0, 1, ' ', 0)
	fmt.Fprintln(w2, "Match\tHome\tWin\tDraw\tAway\tWin")
	for _, f := range fixtures {
		h, a := f[0], f[1]
		ph, pd, pa := matchOdds(h, a)
		fmt.Fprintf(w2, "%s vs %s\t%.1f%%\t%.1f%%\t%.1f%%\n",
			h, a, ph*100, pd*100, pa*100)
	}
	w2.Flush()
}
