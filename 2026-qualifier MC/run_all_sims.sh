#!/bin/bash

echo "Running Go simulation..."
go run simulate.go

echo "Running Python simulation..."
python simulate.py

echo "Running TypeScript simulation..."
yarn tsx simulate.ts

echo "All simulations complete."
