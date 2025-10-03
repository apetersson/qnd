# World Cup 2026 Qualifier Simulation

This project contains multiple implementations of a Monte Carlo simulator for the UEFA Group H World Cup 2026 qualifiers. The primary focus of this project became a deep dive into performance optimization across different languages (Go, TypeScript) and runtimes (Bun).

## Implementations

- **Go (`simulate.go`):** A high-performance, concurrent implementation.
- **TypeScript (`simulate.ts`):** A concurrent implementation using workers, designed to run with Bun.

## The Performance Optimization Journey

We took a methodical, data-driven approach to optimize the simulation, treating it as a series of experiments. The goal was to make both the Go and TypeScript versions as fast as possible.

### 1. TypeScript Optimization

We started by instrumenting the TypeScript version with command-line flags (`--algo`, `--worker`, `--prng`) to test the performance impact of different strategies.

**Key Findings (100M Simulations):**

1.  **Algorithmic Change is King:** The single most impactful optimization was replacing an `O(N log N)` sort operation with an `O(N)` linear scan to find the top two teams. This alone improved performance by **~23%**.
2.  **Runtime Matters:** For this CPU-bound task, Node.js's `worker_threads` API was consistently faster in Bun than the standard Web Worker API.
3.  **PRNG Overhead is Real:** With the main algorithmic bottleneck removed, the overhead of the PRNG became significant. A minimal `xorshift32` implementation proved to be **~8.7%** faster than the built-in `Math.random()` in the optimized version.

**Final Optimized TS Configuration:**
`--algo=scan --worker=threads --prng=xorshift32`

### 2. Go Optimization

The Go version was already fast, using an efficient linear scan from the start. We tested if the PRNG optimization from the TypeScript experiments would apply.

**Key Findings (100M Simulations):**

The `xorshift32` PRNG was a massive success in Go, improving performance by **~18.4%** over the standard `math/rand` library.

| Go PRNG Version | Time (s) | Improvement |
| :--- | :--- | :--- |
| `math/rand` | 3.96 | (Baseline) |
| `xorshift32` | **3.23** | **-18.4%** |

### 3. Advanced Go Optimization: PGO

As a final step, we applied Profile-Guided Optimization (PGO) to the Go version. This allows the compiler to use runtime profile data to make more intelligent optimization decisions.

**PGO was a decisive win**, improving performance by another **16.1%** on top of all previous optimizations.

| Go xorshift32 Version | Time (s) | Improvement |
| :--- | :--- | :--- |
| Standard Build | 3.23 | (Baseline) |
| PGO Build | **2.71** | **-16.1%** |

## How to Run the Simulations

### TypeScript

The fastest version is now the default. You can run it with:

```bash
yarn sim:ts groupH.json
```

To experiment with other (slower) options, you can use the flags:

```bash
# Run with the original sort algorithm
yarn sim:ts groupH.json --algo=sort

# Run with the Web Worker API
yarn sim:ts groupH.json --worker=web
```

### Go

The Go version has a similar flag for its PRNG. The fastest (`xorshift32`) is the default.

```bash
# Run the fastest version
go run simulate.go groupH.json

# Run with the standard library's PRNG
go run simulate.go --prng=math groupH.json
```

## How to Build the Optimized Go Executables

The `simulate_` files you see were generated during the PGO benchmark. You can reproduce the final, fastest executable (`simulate_pgo_optimized`) with the following steps:

**Step 1: Build the Instrumented Binary**
This command compiles the program with profiling instrumentation.

```bash
go build -o simulate_instrumented -pgo=auto simulate.go
```

**Step 2: Generate the Profile**
Run the instrumented binary on a representative workload to create a `default.pgo` file.

```bash
./simulate_instrumented groupH.json
```

**Step 3: Build the Final Optimized Binary**
Compile the program again. The compiler will automatically find and use `default.pgo` to apply its optimizations.

```bash
go build -o simulate_pgo_optimized -pgo=auto simulate.go
```

You can now run `./simulate_pgo_optimized` to use the fastest possible version of the simulation.