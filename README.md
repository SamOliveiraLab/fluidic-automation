# 🧫 Pioreactor Lab Dashboard

A custom bioreactor monitoring dashboard for the Oliveira Lab's Pioreactor cluster. Built to visualize live sensor data, control fluidic automation, and provide AI-powered biological interpretations.

## What This Is

This dashboard connects to a network of [Pioreactor](https://pioreactor.com) bioreactors and displays real-time data including:

- **Optical Density (OD)** - Culture growth monitoring with 90° light scatter
- **Temperature** - Thermal control and tracking
- **Stirring (RPM)** - Mixing speed and stir bar health
- **Pump Control** - Media, waste, and alt-media dosing automation
- **AI Interpretation** - Claude-powered biological analysis of sensor data

## Current Status

| Module | Status |
|--------|--------|
| Reactor status cards | ✅ Live |
| OD readings chart | ✅ Live (snapshot data) |
| Biological interpretation | ✅ Working (simulated) |
| Light/Dark mode | ✅ Working |
| Temperature monitoring | 🟡 Coming soon |
| Stirring monitoring | 🟡 Coming soon |
| Growth rate | 🟡 Coming soon |
| Pump control panel | 🔴 Needs hardware |
| Dosing event log | 🔴 Needs hardware |
| Smart alerts | 🔴 Future |



## API Endpoints Used

```
GET /api/workers
GET /api/experiments
GET /api/experiments/{name}/time_series/od_readings
GET /api/experiments/{name}/time_series/temperature_readings
GET /api/experiments/{name}/time_series/stirring_rates
```

Base URL: `http://oliveirapioreactor01.local`

## Tech Stack

- React + Recharts (data visualization)
- Pioreactor REST API (data source)
- Anthropic Claude API (biological interpretation)
- Tailwind-compatible styling with custom theme system

## Getting Started

1. Ensure your Pioreactor cluster is running on the local network
2. Clone this repo
3. Open `src/Dashboard.jsx` in your React environment
4. The dashboard currently uses snapshot data - swap to live API calls when deploying on the lab network
