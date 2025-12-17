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
import YAML from "yaml";
import rawDataset from "../data/protests.yaml?raw";
import { computeProbability } from "./lib/model";

type Preset = { name: string; year: number; gini: number; inflation: number; unemployment: number; label: 0 | 1 };
type DatasetFile = { positives: Omit<Preset, "label">[]; negatives: Omit<Preset, "label">[] };

type WeightPreset = {
  label: string;
  intercept: number;
  betaGini: number;
  betaInflation: number;
  betaUnemployment: number;
};

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

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const pickRiskBand = (prob: number): RiskBand => {
  const match = riskBands.find((band) => prob <= band.max);
  return match ?? riskBands[riskBands.length - 1];
};

const weightPresets: WeightPreset[] = [
  {
    label: "Original (core)",
    intercept: -8.089,
    betaGini: 0.071,
    betaInflation: 0.421,
    betaUnemployment: 1.212,
  },
  {
    label: "Updated (full YAML)",
    intercept: -6.961498,
    betaGini: 0.167157,
    betaInflation: 1.361028,
    betaUnemployment: 0.880688,
  },
  {
    label: "World Bank weights",
    intercept: -5.311394,
    betaGini: 0.203852,
    betaInflation: 1.298661,
    betaUnemployment: 0.62333,
  },
  {
    label: "Calibrated WB weights",
    intercept: -9.909574,
    betaGini: 0.159225,
    betaInflation: 1.234946,
    betaUnemployment: 0.578736,
  },


  /*{
    label: "World Bank weights",
    intercept: -0.928731,
    betaGini: 0.442742,
    betaInflation: -0.018174,
    betaUnemployment: 0.289123,
  },*/
/*  Samples: 42 (30 positives / 12 negatives)
β₀ (intercept): -0.928731
β_gini:         0.442742
β_inflation:    -0.018174
β_unemployment: 0.289123*/

];

const RiotProbabilityCalculator = () => {
  const dataset = useMemo<Preset[]>(() => {
    const parsed = YAML.parse(rawDataset) as DatasetFile;
    const combined: Preset[] = [
      ...parsed.positives.map((p) => ({ ...p, label: 1 as const })),
      ...parsed.negatives.map((n) => ({ ...n, label: 0 as const })),
    ];
    return combined.sort((a, b) => a.year - b.year);
  }, []);

  const groupedByYear = useMemo(() => {
    const groups = new Map<number, Preset[]>();
    dataset.forEach((p) => {
      if (!groups.has(p.year)) groups.set(p.year, []);
      groups.get(p.year)!.push(p);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => b - a);
  }, [dataset]);

  // Betas
  const [intercept, setIntercept] = useState(-5.311394);
  const [betaGini, setBetaGini] = useState(0.203852);
  const [betaInflation, setBetaInflation] = useState(1.298661);
  const [betaUnemployment, setBetaUnemployment] = useState(0.62333);

  // Features
  const [gini, setGini] = useState(0.3);
  const [inflation, setInflation] = useState(5);
  const [unemployment, setUnemployment] = useState(10);
  const [probability, setProbability] = useState<number>(0);

  useEffect(() => {
    setProbability(
      computeProbability(gini, inflation, unemployment, {
        intercept,
        betaGini,
        betaInflation,
        betaUnemployment,
      })
    );
  }, [gini, inflation, unemployment, intercept, betaGini, betaInflation, betaUnemployment]);

  const risk = useMemo(() => pickRiskBand(probability), [probability]);

  const handlePreset = (preset: Preset) => {
    setGini(preset.gini);
    setInflation(preset.inflation);
    setUnemployment(preset.unemployment);
  };

  const applyWeightPreset = (wp: WeightPreset) => {
    setIntercept(wp.intercept);
    setBetaGini(wp.betaGini);
    setBetaInflation(wp.betaInflation);
    setBetaUnemployment(wp.betaUnemployment);
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
                    Binary Logistic Regression Model Weights
                  </Typography>
                  <Chip label="Logit" size="small" variant="outlined" sx={{ borderColor: "rgba(255,255,255,0.2)", color: "#e2e8f0" }} />
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {weightPresets.map((wp) => (
                    <Button
                      key={wp.label}
                      size="small"
                      variant="outlined"
                      onClick={() => applyWeightPreset(wp)}
                      sx={{
                        textTransform: "none",
                        borderColor: "rgba(255,255,255,0.2)",
                        color: "#e2e8f0",
                        "&:hover": { borderColor: "#38bdf8" },
                      }}
                    >
                      {wp.label}
                    </Button>
                  ))}
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
                <Stack spacing={1.5}>
                  {groupedByYear.map(([year, entries]) => (
                    <Stack key={year} spacing={0.75}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Divider sx={{ flex: 1, borderColor: "rgba(255,255,255,0.08)" }} />
                        <Chip label={year} size="small" sx={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#e2e8f0" }} />
                        <Divider sx={{ flex: 1, borderColor: "rgba(255,255,255,0.08)" }} />
                      </Stack>
                      <Grid container spacing={1.2}>
                        {entries.map((example, idx) => {
                          const prob = computeProbability(example.gini, example.inflation, example.unemployment, {
                            intercept,
                            betaGini,
                            betaInflation,
                            betaUnemployment,
                          });
                          const band = pickRiskBand(prob);
                          const labelChip =
                            example.label === 1
                              ? { text: "Protest", bg: band.glow, color: band.color }
                              : { text: "Stable", bg: "rgba(255,255,255,0.06)", color: "#e2e8f0" };

                          return (
                            <Grid size={{ xs: 12, sm: 6, md: 6 }} key={`${year}-${idx}-${example.name}`}>
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
                                <Chip
                                  label={labelChip.text}
                                  size="small"
                                  sx={{ backgroundColor: labelChip.bg, color: labelChip.color }}
                                />
                              </Button>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default RiotProbabilityCalculator;
