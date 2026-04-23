"""Unit detail dialog: live OD, temp, growth rate charts for one unit."""
from PyQt6.QtCore import QTimer, Qt
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QFrame,
)
import pyqtgraph as pg

from environnets.ui.theme import (
    ACCENT, ACCENT_DIM, BG_DARK, BG_CARD, BG_PANEL, BG_HOVER,
    BORDER, TEXT_PRIMARY, TEXT_SECONDARY, GREEN,
)

pg.setConfigOption("background", BG_DARK)
pg.setConfigOption("foreground", TEXT_SECONDARY)


class UnitDetailDialog(QDialog):
    def __init__(self, api, experiment_name, unit, parent=None):
        super().__init__(parent)
        self.api = api
        self.exp = experiment_name
        self.unit = unit
        self.setWindowTitle(f"Unit detail - {unit.label}")
        self.resize(900, 640)
        self.setStyleSheet(f"background:{BG_DARK};color:{TEXT_PRIMARY}")

        root = QVBoxLayout(self)
        root.setContentsMargins(20, 20, 20, 20)
        root.setSpacing(14)

        hdr = QHBoxLayout()
        title = QLabel(f"{unit.label}")
        title.setStyleSheet("font-size:18px;font-weight:500")
        sub = QLabel(f"{unit.pioreactor_unit or 'not linked'} \u00b7 {unit.type_id}")
        sub.setStyleSheet(f"color:{TEXT_SECONDARY};font-size:12px")
        col = QVBoxLayout()
        col.setSpacing(2)
        col.addWidget(title)
        col.addWidget(sub)
        hdr.addLayout(col)
        hdr.addStretch()

        dose_btn = QPushButton("Dose 0.5 mL media")
        dose_btn.setStyleSheet(
            f"QPushButton{{background:{ACCENT_DIM};color:{TEXT_PRIMARY};border:1px solid {ACCENT_DIM};"
            f"border-radius:6px;padding:8px 16px;font-weight:500}}"
            f"QPushButton:hover{{background:{ACCENT};color:#fff}}"
        )
        dose_btn.clicked.connect(self._dose)
        if unit.category == "pump":
            hdr.addWidget(dose_btn)
        root.addLayout(hdr)

        # Three charts
        self.od_plot = self._make_plot("OD (optical density)", "#7a9ec7")
        self.temp_plot = self._make_plot("Temperature (C)", "#c48a5a")
        self.gr_plot = self._make_plot("Growth rate", "#8a7ab5")
        root.addWidget(self.od_plot, 1)
        root.addWidget(self.temp_plot, 1)
        root.addWidget(self.gr_plot, 1)

        self.od_curve = self.od_plot.plot(pen=pg.mkPen("#7a9ec7", width=2))
        self.temp_curve = self.temp_plot.plot(pen=pg.mkPen("#c48a5a", width=2))
        self.gr_curve = self.gr_plot.plot(pen=pg.mkPen("#8a7ab5", width=2))

        self._timer = QTimer(self)
        self._timer.timeout.connect(self._refresh)
        self._timer.start(5000)
        self._refresh()

    def _make_plot(self, title, color):
        pw = pg.PlotWidget(title=title)
        pw.showGrid(x=True, y=True, alpha=0.2)
        pw.setMinimumHeight(140)
        return pw

    def _dose(self):
        if self.unit.pioreactor_unit:
            self.api.dose_media(self.unit.pioreactor_unit, self.exp, 0.5)

    def _refresh(self):
        if not self.unit.pioreactor_unit:
            return
        try:
            for getter, curve in [
                (self.api.get_od_readings, self.od_curve),
                (self.api.get_temperature_readings, self.temp_curve),
                (self.api.get_growth_rates, self.gr_curve),
            ]:
                raw = getter(self.exp)
                if not raw or not raw.get("series"):
                    continue
                for idx, name in enumerate(raw["series"]):
                    if name.rsplit("-", 1)[0] != self.unit.pioreactor_unit:
                        continue
                    data = raw["data"][idx]
                    if not data:
                        continue
                    ys = [p.get("y", 0) for p in data[-200:]]
                    xs = list(range(len(ys)))
                    curve.setData(xs, ys)
                    break
        except Exception:
            pass
