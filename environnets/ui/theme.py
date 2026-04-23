"""Shared theme constants and stylesheet for the application."""

# --- Palette ---------------------------------------------------------------
# Neutral dark grays (no blue/purple tint)
BG_DARK = "#111113"
BG_PANEL = "#18181b"
BG_CARD = "#1f1f23"
BG_INPUT = "#141416"
BG_HOVER = "#26262c"

# Single accent — desaturated steel-blue
ACCENT = "#6b8afd"
ACCENT_HOVER = "#8aa2ff"
ACCENT_DIM = "#3b4f80"

# Text
TEXT_PRIMARY = "#dcdce0"
TEXT_SECONDARY = "#7c7c8a"
TEXT_MUTED = "#4e4e5a"

# Borders
BORDER = "#2a2a35"
BORDER_HOVER = "#3a3a48"

# Status — muted, not neon
RED = "#bf5555"
GREEN = "#4a9e6e"
AMBER = "#b89540"
BLUE = "#5580c2"

STATUS_COLORS = {
    "disconnected": RED,
    "idle": AMBER,
    "running": GREEN,
    "connected": GREEN,
    "offline": TEXT_MUTED,
}

# --- Stylesheet ------------------------------------------------------------

STYLESHEET = f"""
QMainWindow {{
    background-color: {BG_DARK};
}}
QWidget {{
    color: {TEXT_PRIMARY};
    font-family: "Inter", "SF Pro Text", "Helvetica Neue", -apple-system, sans-serif;
    font-size: 13px;
}}
QLabel {{
    color: {TEXT_PRIMARY};
}}
QLabel[class="heading"] {{
    font-size: 18px;
    font-weight: 500;
    color: {TEXT_PRIMARY};
}}
QLabel[class="subheading"] {{
    font-size: 14px;
    font-weight: 400;
    color: {TEXT_SECONDARY};
}}
QLabel[class="muted"] {{
    font-size: 12px;
    color: {TEXT_MUTED};
}}

/* --- Sidebar --- */
QFrame#sidebar {{
    background-color: {BG_PANEL};
    border-right: 1px solid {BORDER};
}}

/* --- Cards --- */
QFrame[class="card"] {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER};
    border-radius: 8px;
    padding: 16px;
}}

/* --- Buttons --- */
QPushButton {{
    background-color: transparent;
    color: {TEXT_SECONDARY};
    border: 1px solid {BORDER};
    border-radius: 6px;
    padding: 7px 14px;
    font-size: 13px;
}}
QPushButton:hover {{
    color: {TEXT_PRIMARY};
    background-color: {BG_HOVER};
    border-color: {BORDER_HOVER};
}}
QPushButton:pressed {{
    background-color: {BG_INPUT};
}}
QPushButton[class="primary"] {{
    background-color: {ACCENT_DIM};
    color: {TEXT_PRIMARY};
    border: 1px solid {ACCENT_DIM};
    font-weight: 500;
}}
QPushButton[class="primary"]:hover {{
    background-color: {ACCENT};
    color: #fff;
}}
QPushButton[class="danger"] {{
    background-color: transparent;
    color: {RED};
    border: 1px solid {BORDER};
}}
QPushButton[class="danger"]:hover {{
    background-color: #2a1a1a;
    border-color: {RED};
}}

/* --- Inputs --- */
QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox {{
    background-color: {BG_INPUT};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER};
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
}}
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QComboBox:focus {{
    border-color: {ACCENT_DIM};
}}
QComboBox::drop-down {{
    border: none;
    padding-right: 8px;
}}
QComboBox QAbstractItemView {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER};
    selection-background-color: {BG_HOVER};
}}

/* --- ScrollArea --- */
QScrollArea {{
    border: none;
    background: transparent;
}}
QScrollBar:vertical {{
    background: {BG_PANEL};
    width: 6px;
    border-radius: 3px;
}}
QScrollBar::handle:vertical {{
    background: {BORDER};
    border-radius: 3px;
    min-height: 30px;
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0;
}}

/* --- Status bar --- */
QStatusBar {{
    background-color: {BG_PANEL};
    border-top: 1px solid {BORDER};
    color: {TEXT_SECONDARY};
    font-size: 12px;
}}

/* --- List widgets --- */
QListWidget {{
    background-color: transparent;
    border: none;
    outline: none;
}}
QListWidget::item {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER};
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 4px;
    color: {TEXT_SECONDARY};
}}
QListWidget::item:selected {{
    background-color: {BG_HOVER};
    border-color: {ACCENT_DIM};
    color: {TEXT_PRIMARY};
}}
QListWidget::item:hover {{
    border-color: {BORDER_HOVER};
    color: {TEXT_PRIMARY};
}}
"""
