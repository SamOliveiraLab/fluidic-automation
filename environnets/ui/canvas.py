"""Network canvas widget.

This is the core of the app. A 2D canvas where you:
  - Drag units (bioreactors, pumps, sensors) from a palette
  - Place them on the canvas
  - Draw connections between them
  - See green/red status for each unit
  - Double-click a unit to see its detail panel

Implemented as a custom QWidget with QPainter drawing.
"""

import math
import uuid

from PyQt6.QtCore import Qt, QPointF, QRectF, QTimer, QSize
from PyQt6.QtGui import (
    QPainter, QPen, QColor, QBrush, QFont,
    QPainterPath, QLinearGradient, QMouseEvent, QPaintEvent,
    QDragEnterEvent, QDropEvent,
)
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QFrame, QScrollArea, QSizePolicy,
    QToolButton, QMenu,
)

from environnets.core import PioAPI
from environnets.core.models import Store, Network, Unit, Connection
from environnets.ui.theme import (
    ACCENT, GREEN, RED, AMBER, TEXT_PRIMARY, TEXT_SECONDARY,
    TEXT_MUTED, BG_CARD, BG_DARK, BG_PANEL, BG_INPUT, BORDER, BLUE,
)


# -- palette definitions ---------------------------------------------------

UNIT_DEFS = {
    "bioreactor": {"label": "Bioreactor", "icon": "\u2B21", "color": ACCENT, "w": 130, "h": 100},
    "media_pump": {"label": "Media pump", "icon": "\u25B6", "color": BLUE, "w": 110, "h": 80},
    "waste_pump": {"label": "Waste pump", "icon": "\u25C0", "color": "#e07040", "w": 110, "h": 80},
    "sensor":     {"label": "Sensor", "icon": "\u25C9", "color": AMBER, "w": 100, "h": 80},
}

STATUS_COLORS = {
    "disconnected": RED,
    "idle": AMBER,
    "running": GREEN,
    "connected": GREEN,
}


class CanvasWidget(QWidget):
    """The actual painting surface."""

    def __init__(self, parent_canvas: "NetworkCanvas"):
        super().__init__()
        self.parent_canvas = parent_canvas
        self.setMinimumSize(800, 600)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.setMouseTracking(True)
        self.setAcceptDrops(True)

        self._dragging_unit: Unit | None = None
        self._drag_offset = QPointF(0, 0)
        self._hover_unit: Unit | None = None
        self._connecting_from: Unit | None = None
        self._mouse_pos = QPointF(0, 0)

        # Grid
        self._grid_size = 20

    @property
    def network(self) -> Network | None:
        return self.parent_canvas.network

    # -- drawing -----------------------------------------------------------

    def paintEvent(self, event: QPaintEvent):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)

        # Background
        p.fillRect(self.rect(), QColor(BG_DARK))

        # Subtle grid dots
        p.setPen(QPen(QColor(BORDER), 1))
        for x in range(0, self.width(), self._grid_size):
            for y in range(0, self.height(), self._grid_size):
                p.drawPoint(x, y)

        if not self.network:
            self._draw_empty_state(p)
            p.end()
            return

        # Draw connections
        for conn in self.network.connections:
            self._draw_connection(p, conn)

        # Draw "connecting" preview line
        if self._connecting_from:
            src = self._connecting_from
            sx = src.x + UNIT_DEFS.get(src.kind, {}).get("w", 100) / 2
            sy = src.y + UNIT_DEFS.get(src.kind, {}).get("h", 80) / 2
            p.setPen(QPen(QColor(ACCENT), 2, Qt.PenStyle.DashLine))
            p.drawLine(QPointF(sx, sy), self._mouse_pos)

        # Draw units
        for unit in self.network.units:
            self._draw_unit(p, unit)

        p.end()

    def _draw_empty_state(self, p: QPainter):
        p.setPen(QPen(QColor(TEXT_MUTED)))
        f = QFont("Segoe UI", 14)
        p.setFont(f)
        r = self.rect()
        p.drawText(r, Qt.AlignmentFlag.AlignCenter, "Drag units from the palette on the left\nto build your bioreactor network")

    def _draw_unit(self, p: QPainter, unit: Unit):
        defn = UNIT_DEFS.get(unit.kind, UNIT_DEFS["bioreactor"])
        w, h = defn["w"], defn["h"]
        x, y = unit.x, unit.y
        rect = QRectF(x, y, w, h)

        # Card background
        is_hover = unit == self._hover_unit
        bg = QColor(BG_CARD) if not is_hover else QColor(BG_INPUT)
        p.setBrush(QBrush(bg))

        # Border color from status
        status_color = STATUS_COLORS.get(unit.status, RED)
        border_pen = QPen(QColor(status_color), 2 if is_hover else 1.5)
        p.setPen(border_pen)

        path = QPainterPath()
        path.addRoundedRect(rect, 10, 10)
        p.drawPath(path)

        # Status dot
        dot_r = 5
        dot_x = x + w - 14
        dot_y = y + 14
        p.setBrush(QBrush(QColor(status_color)))
        p.setPen(Qt.PenStyle.NoPen)
        p.drawEllipse(QPointF(dot_x, dot_y), dot_r, dot_r)

        # Icon
        p.setPen(QPen(QColor(defn["color"])))
        icon_font = QFont("Segoe UI", 20)
        p.setFont(icon_font)
        icon_rect = QRectF(x, y + 8, w, 36)
        p.drawText(icon_rect, Qt.AlignmentFlag.AlignCenter, defn["icon"])

        # Label
        p.setPen(QPen(QColor(TEXT_PRIMARY)))
        label_font = QFont("Segoe UI", 11, QFont.Weight.Medium)
        p.setFont(label_font)
        label_rect = QRectF(x + 4, y + 46, w - 8, 20)
        label_text = unit.label or defn["label"]
        p.drawText(label_rect, Qt.AlignmentFlag.AlignCenter, label_text)

        # Hostname subtitle
        if unit.pioreactor_unit:
            p.setPen(QPen(QColor(TEXT_MUTED)))
            sub_font = QFont("Segoe UI", 9)
            p.setFont(sub_font)
            sub_rect = QRectF(x + 4, y + 64, w - 8, 16)
            short_name = unit.pioreactor_unit.replace("oliveirapioreactor", "pio")
            p.drawText(sub_rect, Qt.AlignmentFlag.AlignCenter, short_name)

    def _draw_connection(self, p: QPainter, conn: Connection):
        src = next((u for u in self.network.units if u.uid == conn.source_uid), None)
        tgt = next((u for u in self.network.units if u.uid == conn.target_uid), None)
        if not src or not tgt:
            return
        src_def = UNIT_DEFS.get(src.kind, {})
        tgt_def = UNIT_DEFS.get(tgt.kind, {})

        sx = src.x + src_def.get("w", 100) / 2
        sy = src.y + src_def.get("h", 80) / 2
        tx = tgt.x + tgt_def.get("w", 100) / 2
        ty = tgt.y + tgt_def.get("h", 80) / 2

        pen = QPen(QColor(ACCENT), 2)
        pen.setStyle(Qt.PenStyle.DashLine)
        p.setPen(pen)

        # Curved path
        path = QPainterPath()
        path.moveTo(sx, sy)
        mid_x = (sx + tx) / 2
        path.cubicTo(mid_x, sy, mid_x, ty, tx, ty)
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawPath(path)

        # Arrow head at target
        angle = math.atan2(ty - sy, tx - sx)
        arrow_len = 10
        p.setPen(QPen(QColor(ACCENT), 2))
        p.drawLine(
            QPointF(tx, ty),
            QPointF(tx - arrow_len * math.cos(angle - 0.4), ty - arrow_len * math.sin(angle - 0.4)),
        )
        p.drawLine(
            QPointF(tx, ty),
            QPointF(tx - arrow_len * math.cos(angle + 0.4), ty - arrow_len * math.sin(angle + 0.4)),
        )

    # -- hit testing -------------------------------------------------------

    def _unit_at(self, pos: QPointF) -> Unit | None:
        if not self.network:
            return None
        for unit in reversed(self.network.units):
            defn = UNIT_DEFS.get(unit.kind, {})
            w, h = defn.get("w", 100), defn.get("h", 80)
            rect = QRectF(unit.x, unit.y, w, h)
            if rect.contains(pos):
                return unit
        return None

    # -- mouse events ------------------------------------------------------

    def mousePressEvent(self, event: QMouseEvent):
        pos = event.position()
        unit = self._unit_at(pos)
        if event.button() == Qt.MouseButton.LeftButton and unit:
            self._dragging_unit = unit
            self._drag_offset = QPointF(pos.x() - unit.x, pos.y() - unit.y)
        elif event.button() == Qt.MouseButton.RightButton and unit:
            self._show_unit_menu(unit, event.globalPosition().toPoint())

    def mouseMoveEvent(self, event: QMouseEvent):
        pos = event.position()
        self._mouse_pos = pos

        if self._dragging_unit:
            self._dragging_unit.x = pos.x() - self._drag_offset.x()
            self._dragging_unit.y = pos.y() - self._drag_offset.y()
            self.update()
        else:
            old_hover = self._hover_unit
            self._hover_unit = self._unit_at(pos)
            if old_hover != self._hover_unit:
                self.update()

        if self._connecting_from:
            self.update()

    def mouseReleaseEvent(self, event: QMouseEvent):
        if self._dragging_unit:
            # Snap to grid
            g = self._grid_size
            self._dragging_unit.x = round(self._dragging_unit.x / g) * g
            self._dragging_unit.y = round(self._dragging_unit.y / g) * g
            self._dragging_unit = None
            self._save()
            self.update()

        if self._connecting_from and event.button() == Qt.MouseButton.LeftButton:
            target = self._unit_at(event.position())
            if target and target != self._connecting_from:
                conn = Connection(
                    source_uid=self._connecting_from.uid,
                    target_uid=target.uid,
                )
                self.network.connections.append(conn)
                self._save()
            self._connecting_from = None
            self.update()

    def mouseDoubleClickEvent(self, event: QMouseEvent):
        unit = self._unit_at(event.position())
        if unit:
            self.parent_canvas.open_unit_detail(unit)

    # -- context menu ------------------------------------------------------

    def _show_unit_menu(self, unit: Unit, pos):
        menu = QMenu(self)
        menu.setStyleSheet(f"""
            QMenu {{ background: {BG_CARD}; border: 1px solid {BORDER}; border-radius: 6px; padding: 4px; }}
            QMenu::item {{ padding: 6px 20px; border-radius: 4px; }}
            QMenu::item:selected {{ background: {ACCENT}; color: {BG_DARK}; }}
        """)
        connect_act = menu.addAction("Connect to...")
        rename_act = menu.addAction("Rename")
        menu.addSeparator()
        delete_act = menu.addAction("Remove from canvas")

        chosen = menu.exec(pos)
        if chosen == delete_act:
            self.network.units.remove(unit)
            self.network.connections = [
                c for c in self.network.connections
                if c.source_uid != unit.uid and c.target_uid != unit.uid
            ]
            self._save()
            self.update()
        elif chosen == connect_act:
            self._connecting_from = unit
            self.setCursor(Qt.CursorShape.CrossCursor)
        elif chosen == rename_act:
            from PyQt6.QtWidgets import QInputDialog
            text, ok = QInputDialog.getText(self, "Rename unit", "Label:", text=unit.label)
            if ok and text.strip():
                unit.label = text.strip()
                self._save()
                self.update()

    def _save(self):
        if self.network:
            self.parent_canvas.store.save_network(self.network)


class UnitPalette(QFrame):
    """Side palette listing draggable unit types."""

    def __init__(self, canvas_widget: CanvasWidget):
        super().__init__()
        self.canvas_widget = canvas_widget
        self.setFixedWidth(160)
        self.setStyleSheet(f"background: {BG_PANEL}; border-right: 1px solid {BORDER};")

        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 14, 10, 14)
        layout.setSpacing(8)

        header = QLabel("Unit palette")
        header.setStyleSheet(f"font-size: 12px; font-weight: 500; color: {TEXT_SECONDARY};")
        layout.addWidget(header)

        for kind, defn in UNIT_DEFS.items():
            btn = QPushButton(f" {defn['icon']}  {defn['label']}")
            btn.setStyleSheet(f"""
                QPushButton {{
                    text-align: left;
                    padding: 8px 10px;
                    border: 1px dashed {BORDER};
                    border-radius: 8px;
                    font-size: 12px;
                }}
                QPushButton:hover {{
                    border-color: {defn['color']};
                    background: {BG_INPUT};
                }}
            """)
            btn.clicked.connect(lambda checked, k=kind: self._add_unit(k))
            layout.addWidget(btn)

        layout.addStretch()

        # Instructions
        hint = QLabel("Click to add.\nRight-click unit\nto connect or remove.")
        hint.setStyleSheet(f"font-size: 10px; color: {TEXT_MUTED}; padding-top: 8px;")
        hint.setWordWrap(True)
        layout.addWidget(hint)

    def _add_unit(self, kind: str):
        net = self.canvas_widget.network
        if not net:
            return
        defn = UNIT_DEFS[kind]
        # Place in center-ish, offset by existing unit count
        count = len(net.units)
        unit = Unit(
            uid=f"unit-{uuid.uuid4().hex[:6]}",
            kind=kind,
            label=defn["label"],
            x=200 + (count % 3) * 160,
            y=100 + (count // 3) * 120,
        )
        net.units.append(unit)
        self.canvas_widget._save()
        self.canvas_widget.update()


class NetworkCanvas(QWidget):
    """Full canvas page: palette on left, drawing surface on right."""

    def __init__(self, api: PioAPI, store: Store):
        super().__init__()
        self.api = api
        self.store = store
        self.network: Network | None = None

        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        self._canvas_widget = CanvasWidget(self)
        self._palette = UnitPalette(self._canvas_widget)

        layout.addWidget(self._palette)
        layout.addWidget(self._canvas_widget, 1)

    def load_network(self, net: Network):
        self.network = net
        self._canvas_widget.update()

    def open_unit_detail(self, unit: Unit):
        """Placeholder for drilling into a unit's metrics."""
        from PyQt6.QtWidgets import QMessageBox
        QMessageBox.information(
            self, "Unit detail",
            f"Detail view for {unit.label} ({unit.kind})\n"
            f"Hostname: {unit.pioreactor_unit or 'not assigned'}\n"
            f"Status: {unit.status}\n\n"
            "Full metrics view coming in Phase 4."
        )
