import { useState, useEffect } from "react";
import {
  Button,
  TextField,
  Card,
  CardContent,
  Typography,
  Grid
} from "@mui/material";

// Helper function to get a pastel color based on probability
function getPastelColor(prob: number) {
  if (prob <= 0.2) return "#B3E5FC"; // pastel blue
  if (prob <= 0.4) return "#C8E6C9"; // pastel green
  if (prob <= 0.6) return "#FFF9C4"; // pastel yellow
  if (prob <= 0.8) return "#FFE0B2"; // pastel orange
  return "#FFCCBC"; // pastel red
}

function RiotProbabilityCalculator() {
  // Beta states
  const [intercept, setIntercept] = useState(-8.089);
  const [betaGini, setBetaGini] = useState(0.071);
  const [betaInflation, setBetaInflation] = useState(0.421);
  const [betaUnemployment, setBetaUnemployment] = useState(1.212);

  // Feature states
  const [gini, setGini] = useState(0.3);
  const [inflation, setInflation] = useState(5);
  const [unemployment, setUnemployment] = useState(10);
  const [probability, setProbability] = useState<number | null>(null);

  // Function to compute probability using the user-defined betas
  const computeProbability = (
    g: number,
    i: number,
    u: number,
    b0: number,
    bG: number,
    bI: number,
    bU: number
  ) => {
    const logit = b0 + bG * g + bI * i + bU * u;
    return 1 / (1 + Math.exp(-logit));
  };

  // Recompute probability on changes
  useEffect(() => {
    const prob = computeProbability(
      gini,
      inflation,
      unemployment,
      intercept,
      betaGini,
      betaInflation,
      betaUnemployment
    );
    setProbability(prob);
  }, [gini, inflation, unemployment, intercept, betaGini, betaInflation, betaUnemployment]);

  // Comprehensive presets
  const presetExamples = [
    // Existing items
    { name: "Watts Riots 1965", gini: 0.48, inflation: 1.5, unemployment: 34 },
    { name: "Detroit Riots 1967", gini: 0.45, inflation: 2.8, unemployment: 12 },
    { name: "Newark Riots 1967", gini: 0.45, inflation: 3.6, unemployment: 20 },
    { name: "May 1968 Protests", gini: 0.27, inflation: 5, unemployment: 2 },
    { name: "NYC Blackout Riot 1977", gini: 0.5, inflation: 6.5, unemployment: 65 },
    { name: "Brixton Uprising 1981", gini: 0.35, inflation: 11, unemployment: 13 },
    { name: "Poll Tax Riot 1990", gini: 0.33, inflation: 9.5, unemployment: 7 },
    { name: "Los Angeles Riots 1992", gini: 0.45, inflation: 3, unemployment: 14 },
    { name: "Argentine Crisis 2001", gini: 0.55, inflation: 0, unemployment: 20 },
    { name: "Banlieue Riots 2005", gini: 0.29, inflation: 2, unemployment: 20 },
    { name: "Greek Riots 2008", gini: 0.33, inflation: 4, unemployment: 20 },
    { name: "England Riots 2011", gini: 0.34, inflation: 5, unemployment: 20 },
    { name: "Yellow Vests 2018–19", gini: 0.29, inflation: 2, unemployment: 9 },
    { name: "Chile Revolt 2019", gini: 0.47, inflation: 2, unemployment: 7 },
    { name: "Stable - Norway 2010s", gini: 0.25, inflation: 2, unemployment: 3 },
    { name: "Stable - Japan 1980s", gini: 0.24, inflation: 2, unemployment: 2 },
    { name: "Stable - Germany 2010s", gini: 0.29, inflation: 1, unemployment: 4 },
    // New items
    { name: "People Power Revolution 1986", gini: 0.459, inflation: 50, unemployment: 12.6 },
    { name: "Occupy Wall Street 2011", gini: 0.41, inflation: 3, unemployment: 9 },
    { name: "Euromaidan 2013-2014", gini: 0.256, inflation: 0.5, unemployment: 7.5 },
    { name: "Gezi Park Protests 2013", gini: 0.4, inflation: 7.5, unemployment: 8.7 },
    { name: "Umbrella Movement 2014", gini: 0.537, inflation: 4.4, unemployment: 3.2 },
    { name: "Black Lives Matter 2020", gini: 0.415, inflation: 1.2, unemployment: 14.7 },
    { name: "Hong Kong Protests 2019-2020", gini: 0.539, inflation: 2.9, unemployment: 2.9 },
    { name: "Belarusian Protests 2020", gini: 0.275, inflation: 5.5, unemployment: 4.6 },
    { name: "Myanmar Protests 2021", gini: 0.307, inflation: 6.1, unemployment: 1.6 },
    { name: "Sri Lankan Protests 2022", gini: 0.398, inflation: 6, unemployment: 5.1 },
    { name: "Kazakh Unrest 2022", gini: 0.275, inflation: 8.4, unemployment: 4.9 },
    { name: "Sierra Leone Protests 2022", gini: 0.357, inflation: 38.5, unemployment: 4.3 },
    { name: "Malawi Protests 2025", gini: 0.447, inflation: 28.5, unemployment: 6.8 },
  ];

  return (
    <div style={{ padding: "16px", maxWidth: "1000px", margin: "auto" }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Riot Probability Calculator
          </Typography>
          <Typography variant="h6" gutterBottom>
            Configure Beta Values
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                label="Intercept (β₀)"
                type="number"
                value={intercept}
                onChange={(e) => setIntercept(parseFloat(e.target.value))}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                label="Beta Gini (β₁)"
                type="number"
                value={betaGini}
                onChange={(e) => setBetaGini(parseFloat(e.target.value))}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                label="Beta Inflation (β₂)"
                type="number"
                value={betaInflation}
                onChange={(e) => setBetaInflation(parseFloat(e.target.value))}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                label="Beta Unemployment (β₃)"
                type="number"
                value={betaUnemployment}
                onChange={(e) => setBetaUnemployment(parseFloat(e.target.value))}
              />
            </Grid>
          </Grid>
          <Typography variant="h6" gutterBottom style={{ marginTop: "16px" }}>
            Input Features
          </Typography>
          <TextField
            fullWidth
            label="Gini Coefficient"
            type="number"
            value={gini}
            onChange={(e) => setGini(parseFloat(e.target.value))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Inflation Rate (%)"
            type="number"
            value={inflation}
            onChange={(e) => setInflation(parseFloat(e.target.value))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Unemployment Rate (%)"
            type="number"
            value={unemployment}
            onChange={(e) => setUnemployment(parseFloat(e.target.value))}
            margin="normal"
          />
          {probability !== null && (
            <Typography
              variant="h6"
              style={{
                marginTop: "16px",
                display: "inline-block",
                padding: "4px 8px",
                borderRadius: "4px",
                backgroundColor: getPastelColor(probability),
              }}
            >
              Probability of Protest: {(probability * 100).toFixed(2)}%
            </Typography>
          )}
        </CardContent>
      </Card>
      <div style={{ marginTop: "16px" }}>
        <Typography variant="h6">Preset Examples</Typography>
        <Grid container spacing={2} style={{ marginTop: "8px" }}>
          {presetExamples.map((example, index) => {
            const prob = computeProbability(
              example.gini,
              example.inflation,
              example.unemployment,
              intercept,
              betaGini,
              betaInflation,
              betaUnemployment
            );
            return (
              <Grid item xs={6} sm={4} md={3} key={index}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    setGini(example.gini);
                    setInflation(example.inflation);
                    setUnemployment(example.unemployment);
                  }}
                  style={{ backgroundColor: getPastelColor(prob) }}
                >
                  {example.name}
                  <br />
                  ({(prob * 100).toFixed(2)}%)
                </Button>
              </Grid>
            );
          })}
        </Grid>
      </div>
    </div>
  );
}

export default RiotProbabilityCalculator;
