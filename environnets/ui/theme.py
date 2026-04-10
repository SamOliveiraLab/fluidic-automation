"""Shared theme constants and stylesheet for the application."""

# Color palette
BG_DARK = "#1a1a2e"
BG_PANEL = "#16213e"
BG_CARD = "#1e2a45"
BG_INPUT = "#0f1a30"
ACCENT = "#00d4aa"
ACCENT_DIM = "#007a63"
TEXT_PRIMARY = "#e0e0e0"
TEXT_SECONDARY = "#8892a4"
TEXT_MUTED = "#5a6478"
BORDER = "#2a3a5c"
RED = "#e74c3c"
GREEN = "#00d4aa"
AMBER = "#f0a030"
BLUE = "#3b8bdd"

# Status colors
STATUS_COLORS = {
    "disconnected": RED,
    "idle": AMBER,
    "running": GREEN,
    "connected": GREEN,
    "offline": TEXT_MUTED,
}

STYLESHEET = f"""
QMainWindow {{
    background-color: {BG_DARK};
}}
QWidget {{
    color: {TEXT_PRIMARY};
    font-family: "Segoe UI", "SF Pro Display", "Helvetica Neue", sans-serif;
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

/* Sidebar */
QFrame#sidebar {{
    background-color: {BG_PANEL};
    border-right: 1px solid {BORDER};
}}

/* Cards */
QFrame[class="card"] {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER};
    border-radius: 10px;
    padding: 16px;
}}

/* Buttons */
QPushButton {{
    background-color: {BG_CARD};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER};
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 13px;
}}
QPushButton:hover {{
    background-color: {BG_INPUT};
    border-color: {ACCENT_DIM};
}}
QPushButton:pressed {{
    background-color: {ACCENT_DIM};
}}
QPushButton[class="primary"] {{
    background-color: {ACCENT};
    color: {BG_DARK};
    border: none;
    font-weight: 500;
}}
QPushButton[class="primary"]:hover {{
    background-color: #00eabb;
}}
QPushButton[class="danger"] {{
    background-color: {RED};
    color: white;
    border: none;
}}

/* Inputs */
QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox {{
    background-color: {BG_INPUT};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER};
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
}}
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QComboBox:focus {{
    border-color: {ACCENT};
}}
QComboBox::drop-down {{
    border: none;
    padding-right: 8px;
}}
QComboBox QAbstractItemView {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER};
    selection-background-color: {ACCENT_DIM};
}}

/* ScrollArea */
QScrollArea {{
    border: none;
    background: transparent;
}}
QScrollBar:vertical {{
    background: {BG_PANEL};
    width: 8px;
    border-radius: 4px;
}}
QScrollBar::handle:vertical {{
    background: {BORDER};
    border-radius: 4px;
    min-height: 30px;
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0;
}}

/* Status bar */
QStatusBar {{
    background-color: {BG_PANEL};
    border-top: 1px solid {BORDER};
    color: {TEXT_SECONDARY};
    font-size: 12px;
}}

/* List widgets */
QListWidget {{
    background-color: transparent;
    border: none;
    outline: none;
}}
QListWidget::item {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER};
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 6px;
}}
QListWidget::item:selected {{
    background-color: {ACCENT_DIM};
    border-color: {ACCENT};
}}
QListWidget::item:hover {{
    border-color: {ACCENT_DIM};
}}
"""
