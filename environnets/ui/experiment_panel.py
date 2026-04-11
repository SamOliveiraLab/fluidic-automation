"""Experiment view: canvas + inline controls."""
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QFrame, QDoubleSpinBox, QSpinBox, QComboBox,
)
from environnets.core.experiments import Experiment, save_experiment
from environnets.ui.canvas import NetworkCanvas
from environnets.ui.theme import (
    ACCENT, GREEN, RED, AMBER, BG_CARD, BG_PANEL, BORDER,
    TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
)


class ExperimentPanel(QWidget):
    def __init__(self, api, store, experiment: Experiment, network):
        super().__init__()
        self.api = api
        self.store = store
        self.experiment = experiment

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # Header bar
        header = QFrame()
        header.setStyleSheet(f"background:{BG_PANEL};border-bottom:1px solid {BORDER}")
        header.setFixedHeight(64)
        hl = QHBoxLayout(header)
        hl.setContentsMargins(20, 10, 20, 10)

        name = QLabel(experiment.name)
        name.setStyleSheet(f"font-size:16px;font-weight:500;color:{TEXT_PRIMARY}")
        desc = QLabel(experiment.description or "No description")
        desc.setStyleSheet(f"font-size:11px;color:{TEXT_MUTED}")

        name_col = QVBoxLayout()
        name_col.setSpacing(2)
        name_col.addWidget(name)
        name_col.addWidget(desc)
        hl.addLayout(name_col)
        hl.addStretch()

        self._status_label = QLabel("Draft")
        self._status_label.setStyleSheet(f"color:{AMBER};font-size:12px;padding:4px 10px;border:1px solid {BORDER};border-radius:6px")
        hl.addWidget(self._status_label)

        self._start_btn = QPushButton("Start experiment")
        self._start_btn.setProperty("class", "primary")
        self._start_btn.setStyleSheet(
            f"QPushButton{{background:{ACCENT};color:#1a1a2e;border:none;border-radius:6px;padding:8px 18px;font-weight:500}}"
            f"QPushButton:hover{{background:#00eabb}}"
        )
        self._start_btn.clicked.connect(self._toggle_experiment)
        hl.addWidget(self._start_btn)

        root.addWidget(header)

        # Parameters strip
        params = QFrame()
        params.setStyleSheet(f"background:{BG_CARD};border-bottom:1px solid {BORDER}")
        params.setFixedHeight(58)
        pl = QHBoxLayout(params)
        pl.setContentsMargins(20, 8, 20, 8)
        pl.setSpacing(14)

        self._mode = QComboBox()
        self._mode.addItems(["Manual", "Chemostat", "Turbidostat"])
        self._mode.setFixedWidth(120)

        self._rpm = QSpinBox()
        self._rpm.setRange(0, 1500)
        self._rpm.setValue(int(experiment.parameters.get("rpm", 400)))
        self._rpm.setSuffix(" rpm")
        self._rpm.setFixedWidth(100)

        self._temp = QDoubleSpinBox()
        self._temp.setRange(15.0, 50.0)
        self._temp.setValue(float(experiment.parameters.get("temp", 30.0)))
        self._temp.setSuffix(" C")
        self._temp.setFixedWidth(90)

        self._vol = QDoubleSpinBox()
        self._vol.setRange(0.01, 10.0)
        self._vol.setValue(float(experiment.parameters.get("vol", 0.5)))
        self._vol.setSuffix(" mL")
        self._vol.setFixedWidth(90)

        self._interval = QSpinBox()
        self._interval.setRange(1, 1440)
        self._interval.setValue(int(experiment.parameters.get("interval", 15)))
        self._interval.setSuffix(" min")
        self._interval.setFixedWidth(100)

        for w, lbl in [(self._mode, "Mode"), (self._rpm, "Stir"),
                       (self._temp, "Temp"), (self._vol, "Dose"), (self._interval, "Every")]:
            col = QVBoxLayout()
            col.setSpacing(1)
            l = QLabel(lbl)
            l.setStyleSheet(f"font-size:10px;color:{TEXT_SECONDARY}")
            col.addWidget(l)
            col.addWidget(w)
            wrap = QWidget()
            wrap.setLayout(col)
            pl.addWidget(wrap)

        pl.addStretch()
        root.addWidget(params)

        # Canvas
        self.canvas = NetworkCanvas(api, store)
        self.canvas.current_experiment_name = experiment.name
        if network:
            self.canvas.load_network(network)
        root.addWidget(self.canvas, 1)

        self._od_timer = QTimer(self)
        self._od_timer.timeout.connect(self._poll_telemetry)
        self._od_timer.start(10000)

    def _poll_telemetry(self):
        if not self.canvas.network:
            return
        try:
            od = self.api.get_od_readings(self.experiment.name)
            if not od or not od.get("series"):
                return
            latest = {}
            for idx, name in enumerate(od["series"]):
                unit_name = name.rsplit("-", 1)[0]
                data = od["data"][idx] if idx < len(od["data"]) else []
                if data:
                    latest[unit_name] = data[-1].get("y", 0.0)
            for u in self.canvas.network.units:
                if u.pioreactor_unit and u.pioreactor_unit in latest:
                    u.last_od = float(latest[u.pioreactor_unit])
        except Exception:
            pass

    def _toggle_experiment(self):
        if self.experiment.status != "running":
            self._start_experiment()
        else:
            self._stop_experiment()

    def _start_experiment(self):
        if not self.canvas.network:
            return
        reactors = [u for u in self.canvas.network.units
                    if u.category == "reactor" and u.pioreactor_unit]
        if not reactors:
            from PyQt6.QtWidgets import QMessageBox
            QMessageBox.warning(self, "No hardware",
                "Link at least one bioreactor to hardware before starting.")
            return

        exp_name = self.experiment.name
        for r in reactors:
            self.api.start_stirring(r.pioreactor_unit, exp_name, self._rpm.value())
            self.api.start_od_reading(r.pioreactor_unit, exp_name)
            self.api.start_growth_rate(r.pioreactor_unit, exp_name)
            self.api.start_temperature(r.pioreactor_unit, exp_name, self._temp.value())
            if self._mode.currentText() == "Chemostat":
                self.api.start_chemostat(r.pioreactor_unit, exp_name,
                                         self._vol.value(), self._interval.value())
            r.status = "running"

        # Mark linked pumps as running so cartoons animate
        for u in self.canvas.network.units:
            if u.category == "pump" and u.pioreactor_unit:
                u.status = "running"

        self.experiment.status = "running"
        self.experiment.parameters = {
            "rpm": self._rpm.value(), "temp": self._temp.value(),
            "vol": self._vol.value(), "interval": self._interval.value(),
            "mode": self._mode.currentText(),
        }
        save_experiment(self.store, self.experiment)
        self.store.save_network(self.canvas.network)
        self._update_status_ui()

    def _stop_experiment(self):
        if not self.canvas.network:
            return
        exp_name = self.experiment.name
        for u in self.canvas.network.units:
            if u.pioreactor_unit:
                for job in ["dosing_automation", "growth_rate_calculating",
                            "od_reading", "temperature_automation", "stirring"]:
                    self.api.stop_job(u.pioreactor_unit, job, exp_name)
                u.status = "idle"
        self.experiment.status = "stopped"
        save_experiment(self.store, self.experiment)
        self.store.save_network(self.canvas.network)
        self._update_status_ui()

    def _update_status_ui(self):
        if self.experiment.status == "running":
            self._status_label.setText("Running")
            self._status_label.setStyleSheet(
                f"color:{GREEN};font-size:12px;padding:4px 10px;border:1px solid {GREEN};border-radius:6px"
            )
            self._start_btn.setText("Stop experiment")
            self._start_btn.setStyleSheet(
                f"QPushButton{{background:{RED};color:white;border:none;border-radius:6px;padding:8px 18px;font-weight:500}}"
            )
        else:
            self._status_label.setText(self.experiment.status.capitalize())
            self._status_label.setStyleSheet(
                f"color:{AMBER};font-size:12px;padding:4px 10px;border:1px solid {BORDER};border-radius:6px"
            )
            self._start_btn.setText("Start experiment")
            self._start_btn.setStyleSheet(
                f"QPushButton{{background:{ACCENT};color:#1a1a2e;border:none;border-radius:6px;padding:8px 18px;font-weight:500}}"
                f"QPushButton:hover{{background:#00eabb}}"
            )
