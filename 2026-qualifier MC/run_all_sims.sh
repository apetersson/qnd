#!/bin/bash

#!/bin/bash

CONFIG_FILE=${1:-groupH.json}



echo "Running Go simulation..."
time go run simulate.go "$CONFIG_FILE"

# Install Python dependencies
echo "Running Python simulation..."
pip install PyYAML
time python simulate.py "$CONFIG_FILE"

echo "Running TypeScript simulation..."
time yarn tsx simulate.ts "$CONFIG_FILE"

echo "Running TypeScript simulation 2..."
time yarn sim:ts "$CONFIG_FILE"

echo "All simulations complete."