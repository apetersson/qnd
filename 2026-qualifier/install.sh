#!/bin/bash

# Install Node.js dependencies using Yarn
if [ -f "package.json" ]; then
  echo "Installing Node.js dependencies..."
  yarn install
else
  echo "package.json not found. Skipping Node.js dependency installation."
fi

# Install Go dependencies
if [ -f "go.mod" ]; then
  echo "Installing Go dependencies..."
  go mod tidy
else
  echo "go.mod not found. Skipping Go dependency installation."
fi

# Install Python dependencies (if requirements.txt exists)
if [ -f "requirements.txt" ]; then
  echo "Installing Python dependencies..."
  pip install -r requirements.txt
else
  echo "requirements.txt not found. Skipping Python dependency installation."
fi

echo "Dependency installation complete."
