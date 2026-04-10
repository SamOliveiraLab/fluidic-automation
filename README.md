# EnvironNets Desktop

Bioreactor network control platform. Design, monitor, and control bioreactor experiments from a visual canvas.

## Quick start

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run
python -m environnets
```

## Project structure

```
environnets/
  __init__.py          # package metadata
  __main__.py          # entry point (python -m environnets)
  core/
    __init__.py        # PioAPI client (talks to Pioreactor REST API)
    models.py          # Network, Unit, Connection models + SQLite storage
  ui/
    __init__.py
    theme.py           # colors, fonts, stylesheet
    main_window.py     # main window with sidebar and content area
    canvas.py          # network canvas (drag-and-drop units)
    connection_dialog.py  # Pioreactor connection settings
```

## Architecture

```
Physical hardware (Pioreactor + pumps)
        |
        | REST API (HTTP)
        |
Python backend (PioAPI client)
        |
        | direct function calls
        |
PyQt6 desktop UI (canvas, charts, controls)
```

## Development phases

- [x] Phase 1: Foundation (window, connection, sidebar)
- [x] Phase 2: Network canvas (drag-and-drop units, connections, status dots)
- [ ] Phase 3: Experiment management
- [ ] Phase 4: Live monitoring and animated vial
- [ ] Phase 5: Controls and automation
- [ ] Phase 6: Polish and packaging
