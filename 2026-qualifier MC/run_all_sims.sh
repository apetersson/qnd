#!/bin/bash

echo "Running Go simulation..."
time go run simulate.go

echo "Running Python simulation..."
time python simulate.py

echo "Running TypeScript simulation..."
time yarn tsx simulate.ts

echo "Running TypeScript simulation 2..."
time yarn sim:ts

echo "All simulations complete."