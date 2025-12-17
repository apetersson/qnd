import { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Slider,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import CalculateIcon from "@mui/icons-material/Calculate";
import PublicIcon from "@mui/icons-material/Public";
import TimelineIcon from "@mui/icons-material/Timeline";
import BoltIcon from "@mui/icons-material/Bolt";

type Preset = { name: string; gini: number; inflation: number; unemployment: number };

type RiskBand = {
  label: string;
  max: number;
  color: string;
  glow: string;
  tone: string;
};

const riskBands: RiskBand[] = [
  { label: "Stable", max: 0.25, color: "#0ea5e9", glow: "rgba(14,165,233,0.18)", tone: "#e0f2fe" },
  { label: "Guarded", max: 0.45, color: "#10b981", glow: "rgba(16,185,129,0.2)", tone: "#d1fae5" },
  { label: "Elevated", max: 0.65, color: "#f59e0b", glow: "rgba(245,158,11,0.18)", tone: "#fef3c7" },
  { label: "Severe", max: 1, color: "#ef4444", glow: "rgba(239,68,68,0.18)", tone: "#fee2e2" },
];

const presets: Preset[] = [
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

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const pickRiskBand = (prob: number): RiskBand => {
  const match = riskBands.find((band) => prob <= band.max);
  return match ?? riskBands[riskBands.length - 1];
};

const RiotProbabilityCalculator = () => {
  // Betas
  const [intercept, setIntercept] = useState(-8.089);
  const [betaGini, setBetaGini] = useState(0.071);
  const [betaInflation, setBetaInflation] = useState(0.421);
  const [betaUnemployment, setBetaUnemployment] = useState(1.212);

  // Features
  const [gini, setGini] = useState(0.3);
  const [inflation, setInflation] = useState(5);
  const [unemployment, setUnemployment] = useState(10);
  const [probability, setProbability] = useState<number>(0);

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

  useEffect(() => {
    setProbability(computeProbability(gini, inflation, unemployment, intercept, betaGini, betaInflation, betaUnemployment));
  }, [gini, inflation, unemployment, intercept, betaGini, betaInflation, betaUnemployment]);

  const risk = useMemo(() => pickRiskBand(probability), [probability]);

  const handlePreset = (preset: Preset) => {
    setGini(preset.gini);
    setInflation(preset.inflation);
    setUnemployment(preset.unemployment);
  };

  const inputField = (
    label: string,
    value: number,
    setter: (n: number) => void,
    props: { min: number; max: number; step?: number; suffix?: string; sliderMax?: number }
  ) => (
    <Stack spacing={1.2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography fontWeight={600}>{label}</Typography>
        <Chip label={`${value}${props.suffix ?? ""}`} size="small" />
      </Stack>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 7 }}>
          <Slider
            min={props.min}
            max={props.sliderMax ?? props.max}
            step={props.step ?? 0.01}
            value={value}
            valueLabelDisplay="auto"
            onChange={(_, v) => setter(Number(v))}
            sx={{ color: risk.color }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 5 }}>
          <TextField
            fullWidth
            type="number"
            label="Value"
            value={value}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value);
              if (Number.isFinite(parsed)) setter(clampNumber(parsed, props.min, props.max));
            }}
            inputProps={{ min: props.min, max: props.max, step: props.step ?? 0.01 }}
          />
        </Grid>
      </Grid>
    </Stack>
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: `radial-gradient(circle at 10% 20%, rgba(14,165,233,0.12), transparent 25%),
                     radial-gradient(circle at 80% 0%, rgba(16,185,129,0.12), transparent 22%),
                     linear-gradient(135deg, #0b1021 0%, #0f172a 45%, #0a0f1c 100%)`,
        color: "#e2e8f0",
        fontFamily: '"Space Grotesk", "Inter", system-ui, -apple-system, sans-serif',
        pb: 6,
      }}
    >
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: "rgba(14, 21, 40, 0.6)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <BoltIcon sx={{ color: "#38bdf8" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Riot Probability Lab
          </Typography>
          <Chip
            label="Beta-adjustable"
            size="small"
            sx={{ ml: 2, backgroundColor: "rgba(56,189,248,0.12)", color: "#7dd3fc" }}
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper
              sx={{
                p: 3,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                backdropFilter: "blur(10px)",
              }}
            >
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CalculateIcon sx={{ color: "#38bdf8" }} />
                  <Typography variant="h5" fontWeight={700}>
                    Configure Model Weights
                  </Typography>
                  <Chip label="Logit" size="small" variant="outlined" sx={{ borderColor: "rgba(255,255,255,0.2)", color: "#e2e8f0" }} />
                </Stack>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Intercept (β₀)"
                      type="number"
                      value={intercept}
                      onChange={(e) => setIntercept(parseFloat(e.target.value) || 0)}
                      helperText="Base log-odds"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Beta Gini (β₁)"
                      type="number"
                      value={betaGini}
                      onChange={(e) => setBetaGini(parseFloat(e.target.value) || 0)}
                      helperText="Income inequality weight"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Beta Inflation (β₂)"
                      type="number"
                      value={betaInflation}
                      onChange={(e) => setBetaInflation(parseFloat(e.target.value) || 0)}
                      helperText="Inflation weight"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Beta Unemployment (β₃)"
                      type="number"
                      value={betaUnemployment}
                      onChange={(e) => setBetaUnemployment(parseFloat(e.target.value) || 0)}
                      helperText="Unemployment weight"
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />

                <Stack direction="row" spacing={1.2} alignItems="center">
                  <TimelineIcon sx={{ color: "#fbbf24" }} />
                  <Typography variant="h6" fontWeight={700}>
                    Input Scenario
                  </Typography>
                  <Chip label="Live" size="small" sx={{ backgroundColor: risk.glow, color: risk.color }} />
                </Stack>

                {inputField("Gini coefficient", gini, setGini, { min: 0, max: 1, step: 0.01 })}
                {inputField("Official Inflation rate (%)", inflation, setInflation, { min: -5, max: 200, step: 0.1, suffix: "%", sliderMax: 100 })}
                {inputField("Official Unemployment rate (%)", unemployment, setUnemployment, { min: 0, max: 100, step: 0.1, suffix: "%" })}
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={3}>
              <Paper
                sx={{
                  p: 3,
                  background: "linear-gradient(135deg, #0b1224, #0f1a33)",
                  color: "#e2e8f0",
                  border: `1px solid ${risk.color}30`,
                  boxShadow: `0 18px 40px ${risk.glow}`,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <BoltIcon sx={{ color: risk.color }} />
                    <Typography variant="h6" fontWeight={800}>
                      Current Probability
                    </Typography>
                    <Chip
                      label={risk.label}
                      sx={{ backgroundColor: risk.glow, color: risk.color, fontWeight: 700 }}
                    />
                  </Stack>
                  <Typography variant="h2" fontWeight={800} sx={{ letterSpacing: -1 }}>
                    {formatPercent(probability)}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={probability * 100}
                    sx={{
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.06)",
                      "& .MuiLinearProgress-bar": { background: risk.color },
                    }}
                  />
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      icon={<PublicIcon />}
                      label={`Gini ${gini}`}
                      sx={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#e2e8f0" }}
                    />
                    <Chip
                      label={`Inflation ${inflation}%`}
                      sx={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#e2e8f0" }}
                    />
                    <Chip
                      label={`Unemployment ${unemployment}%`}
                      sx={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#e2e8f0" }}
                    />
                  </Stack>
                </Stack>
              </Paper>

              <Paper
                sx={{
                  p: 3,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.25)",
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PublicIcon sx={{ color: "#22d3ee" }} />
                    <Typography variant="h6" fontWeight={700}>
                      Historical Presets
                    </Typography>
                  </Stack>
                  <Tooltip title="Use presets to quickly populate inputs">
                    <Chip label="Tap to apply" size="small" variant="outlined" />
                  </Tooltip>
                </Stack>
                <Grid container spacing={1.2}>
                  {presets.map((example, idx) => {
                    const prob = computeProbability(
                      example.gini,
                      example.inflation,
                      example.unemployment,
                      intercept,
                      betaGini,
                      betaInflation,
                      betaUnemployment
                    );
                    const band = pickRiskBand(prob);
                    return (
                      <Grid size={{ xs: 12, sm: 6, md: 6 }} key={idx}>
                        <Button
                          fullWidth
                          onClick={() => handlePreset(example)}
                          sx={{
                            justifyContent: "space-between",
                            color: "#e2e8f0",
                            textTransform: "none",
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: `linear-gradient(120deg, ${band.glow}, rgba(255,255,255,0.04))`,
                            "&:hover": { borderColor: band.color, backgroundColor: "rgba(255,255,255,0.08)" },
                          }}
                        >
                          <Stack alignItems="flex-start">
                            <Typography fontWeight={700}>{example.name}</Typography>
                            <Typography variant="body2" color="rgba(226,232,240,0.8)">
                              {formatPercent(prob)}
                            </Typography>
                          </Stack>
                          <Chip label={band.label} size="small" sx={{ backgroundColor: band.glow, color: band.color }} />
                        </Button>
                      </Grid>
                    );
                  })}
                </Grid>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default RiotProbabilityCalculator;
