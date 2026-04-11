"""Main application window.

Sidebar on the left with network list and connection settings.
Content area on the right that shows the network canvas or unit detail view.
Status bar at the bottom with connection info.
"""

import uuid

from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QIcon
from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QLineEdit, QStackedWidget,
    QFrame, QListWidget, QListWidgetItem, QStatusBar,
    QDialog, QDialogButtonBox, QFormLayout, QMessageBox,
    QSplitter,
)

from environnets.core import PioAPI
from environnets.core.config import get
from environnets.core.models import Store, Network, Unit, Connection
from environnets.ui.theme import (
    STYLESHEET, ACCENT, GREEN, RED, TEXT_SECONDARY,
    TEXT_MUTED, BG_CARD, BG_PANEL, BORDER,
)
from environnets.ui.canvas import NetworkCanvas
from environnets.ui.connection_dialog import ConnectionDialog


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("EnvironNets")
        self.setStyleSheet(STYLESHEET)

        # Core state
        self.store = Store()
        default_url = get("connection", "default_url", "http://localhost")
        self.api = PioAPI(self.store.get_setting("pioreactor_url", default_url))
        self.connected = False
        self.current_network: Network | None = None

        self._build_ui()
        self._load_networks()

        # Connection check timer
        poll_ms = get("connection", "poll_interval_seconds", 10) * 1000
        self._conn_timer = QTimer(self)
        self._conn_timer.timeout.connect(self._check_connection)
        self._conn_timer.start(poll_ms)

        self._ping_timer = QTimer(self)
        self._ping_timer.timeout.connect(self._ping_linked_units)
        self._ping_timer.start(8000)
        self._check_connection()

    # -- UI construction ---------------------------------------------------

    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        layout = QHBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Sidebar
        sidebar = self._build_sidebar()
        sidebar.setObjectName("sidebar")
        sidebar.setFixedWidth(280)

        # Content area
        self.content_stack = QStackedWidget()
        self._build_welcome_page()
        self._build_canvas_page()

        layout.addWidget(sidebar)
        layout.addWidget(self.content_stack, 1)

        # Status bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self._conn_dot = QLabel()
        self._conn_label = QLabel("Checking connection...")
        self.status_bar.addWidget(self._conn_dot)
        self.status_bar.addWidget(self._conn_label)

    def _build_sidebar(self) -> QFrame:
        frame = QFrame()
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(16, 20, 16, 16)
        layout.setSpacing(12)

        # App title
        title = QLabel("EnvironNets")
        title.setStyleSheet(f"font-size: 20px; font-weight: 600; color: {ACCENT}; margin-bottom: 4px;")
        layout.addWidget(title)

        subtitle = QLabel("Bioreactor networks")
        subtitle.setStyleSheet(f"font-size: 12px; color: {TEXT_SECONDARY}; margin-bottom: 12px;")
        layout.addWidget(subtitle)

        # Connection button
        self._conn_btn = QPushButton("Configure connection")
        self._conn_btn.clicked.connect(self._open_connection_dialog)
        layout.addWidget(self._conn_btn)

        # Separator
        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setStyleSheet(f"color: {BORDER};")
        layout.addWidget(sep)

        # Networks section
        net_header = QHBoxLayout()
        net_label = QLabel("Networks")
        net_label.setStyleSheet("font-size: 14px; font-weight: 500;")
        net_add_btn = QPushButton("+")
        net_add_btn.setFixedSize(28, 28)
        net_add_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {ACCENT};
                color: #1a1a2e;
                border: none;
                border-radius: 14px;
                font-size: 16px;
                font-weight: 600;
            }}
            QPushButton:hover {{ background-color: #00eabb; }}
        """)
        net_add_btn.clicked.connect(self._create_network_dialog)
        net_header.addWidget(net_label)
        net_header.addStretch()
        net_header.addWidget(net_add_btn)
        layout.addLayout(net_header)

        # Network list
        self.network_list = QListWidget()
        self.network_list.itemClicked.connect(self._on_network_selected)
        layout.addWidget(self.network_list, 1)

        # Delete network button
        self._del_net_btn = QPushButton("Delete selected network")
        self._del_net_btn.setProperty("class", "danger")
        self._del_net_btn.setVisible(False)
        self._del_net_btn.clicked.connect(self._delete_selected_network)
        layout.addWidget(self._del_net_btn)

        return frame

    def _build_welcome_page(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        icon_label = QLabel()
        icon_label.setStyleSheet(f"font-size: 48px; color: {ACCENT};")
        icon_label.setText("\u2B21")  # hexagon
        icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(icon_label)

        welcome = QLabel("Welcome to EnvironNets")
        welcome.setStyleSheet("font-size: 22px; font-weight: 500; margin-top: 12px;")
        welcome.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(welcome)

        hint = QLabel("Create a bioreactor network to get started.\nClick the + button in the sidebar.")
        hint.setStyleSheet(f"font-size: 14px; color: {TEXT_SECONDARY}; margin-top: 8px;")
        hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(hint)

        self.content_stack.addWidget(page)  # index 0

    def _build_canvas_page(self):
        self.canvas = NetworkCanvas(api=self.api, store=self.store)
        self.content_stack.addWidget(self.canvas)  # index 1

    # -- network management ------------------------------------------------

    def _load_networks(self):
        self.network_list.clear()
        for net in self.store.list_networks():
            item = QListWidgetItem(net["name"])
            item.setData(Qt.ItemDataRole.UserRole, net["network_id"])
            self.network_list.addItem(item)

    def _on_network_selected(self, item: QListWidgetItem):
        net_id = item.data(Qt.ItemDataRole.UserRole)
        net = self.store.load_network(net_id)
        if net:
            self.current_network = net
            self.canvas.load_network(net)
            self.content_stack.setCurrentIndex(1)
            self._del_net_btn.setVisible(True)
            self.setWindowTitle(f"EnvironNets \u2014 {net.name}")

    def _create_network_dialog(self):
        dlg = QDialog(self)
        dlg.setWindowTitle("New bioreactor network")
        dlg.setMinimumWidth(360)
        form = QFormLayout(dlg)

        name_input = QLineEdit()
        name_input.setPlaceholderText("e.g. Single reactor chemostat")
        desc_input = QLineEdit()
        desc_input.setPlaceholderText("Optional description")

        form.addRow("Name:", name_input)
        form.addRow("Description:", desc_input)

        btns = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        btns.accepted.connect(dlg.accept)
        btns.rejected.connect(dlg.reject)
        form.addWidget(btns)

        if dlg.exec() == QDialog.DialogCode.Accepted and name_input.text().strip():
            net = Network(
                network_id=str(uuid.uuid4())[:8],
                name=name_input.text().strip(),
                description=desc_input.text().strip(),
            )
            self.store.save_network(net)
            self._load_networks()
            # Select the new network
            for i in range(self.network_list.count()):
                it = self.network_list.item(i)
                if it.data(Qt.ItemDataRole.UserRole) == net.network_id:
                    self.network_list.setCurrentItem(it)
                    self._on_network_selected(it)
                    break

    def _delete_selected_network(self):
        item = self.network_list.currentItem()
        if not item:
            return
        net_id = item.data(Qt.ItemDataRole.UserRole)
        reply = QMessageBox.question(
            self, "Delete network",
            f"Delete network \"{item.text()}\"? This cannot be undone.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply == QMessageBox.StandardButton.Yes:
            self.store.delete_network(net_id)
            self.current_network = None
            self._del_net_btn.setVisible(False)
            self._load_networks()
            self.content_stack.setCurrentIndex(0)
            self.setWindowTitle("EnvironNets")

    # -- connection --------------------------------------------------------

    def _open_connection_dialog(self):
        dlg = ConnectionDialog(
            current_url=self.store.get_setting("pioreactor_url", "http://localhost"),
            parent=self,
        )
        if dlg.exec() == QDialog.DialogCode.Accepted:
            url = dlg.get_url()
            self.store.set_setting("pioreactor_url", url)
            self.api = PioAPI(url)
            self.canvas.api = self.api
            self._check_connection()

    def _check_connection(self):
        ok = self.api.ping()
        self.connected = ok
        dot = f"\u25CF"
        if ok:
            self._conn_dot.setStyleSheet(f"color: {GREEN}; font-size: 14px;")
            self._conn_dot.setText(dot)
            workers = self.api.get_workers()
            active = [w for w in workers if w.get("is_active")]
            self._conn_label.setText(f"Connected \u00b7 {len(active)} worker(s) active")
            url = self.store.get_setting("pioreactor_url", "")
            short = url.replace("https://","").replace("http://","")[:22]
            self._conn_btn.setText(f"✓ {short}")
        else:
            self._conn_dot.setStyleSheet(f"color: {RED}; font-size: 14px;")
            self._conn_dot.setText(dot)
            self._conn_label.setText("Not connected")
            self._conn_btn.setText("Configure connection")


    def _ping_linked_units(self):
        if not self.connected or not self.current_network:
            return
        reachable = {w["pioreactor_unit"] for w in (self.api.get_workers() or []) if w.get("is_active")}
        changed = False
        for u in self.current_network.units:
            if not u.pioreactor_unit:
                if u.status != "disconnected":
                    u.status = "disconnected"; changed = True
                continue
            if u.pioreactor_unit in reachable:
                if u.status == "disconnected":
                    u.status = "idle"; changed = True
            else:
                if u.status != "disconnected":
                    u.status = "disconnected"; changed = True
        if changed:
            self.store.save_network(self.current_network)
