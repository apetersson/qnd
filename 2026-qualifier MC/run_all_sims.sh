#!/bin/bash

#!/bin/bash

CONFIG_FILE=${1:-groupH.json}

# Install Python dependencies
pip install PyYAML

echo "Running Go simulation..."
time go run simulate.go "$CONFIG_FILE"

echo "Running Python simulation..."
time python simulate.py "$CONFIG_FILE"

echo "Running TypeScript simulation..."
time yarn tsx simulate.ts "$CONFIG_FILE"

echo "Running TypeScript simulation 2..."
time yarn sim:ts "$CONFIG_FILE"

echo "All simulations complete."