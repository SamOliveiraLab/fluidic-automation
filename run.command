#!/bin/bash
# EnvironNets Desktop Launcher
# Double-click this file on macOS to run the app.

cd "$(dirname "$0")"

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    echo "First run: setting up environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    echo ""
    echo "Setup complete."
else
    source venv/bin/activate
fi

# Run the app
python -m environnets
