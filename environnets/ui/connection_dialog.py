"""Connection configuration dialog."""

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QLineEdit, QPushButton, QDialogButtonBox,
)

from environnets.core import PioAPI
from environnets.ui.theme import GREEN, RED, TEXT_SECONDARY, TEXT_MUTED


class ConnectionDialog(QDialog):
    def __init__(self, current_url: str = "", parent=None):
        super().__init__(parent)
        self.setWindowTitle("Pioreactor connection")
        self.setMinimumWidth(440)
        self._url = current_url

        layout = QVBoxLayout(self)
        layout.setSpacing(14)

        info = QLabel(
            "Enter the address of your Pioreactor leader.\n"
            "This can be a local IP (http://192.168.x.x),\n"
            "a .local hostname (http://oliveirapioreactor01.local),\n"
            "or a Cloudflare tunnel URL (https://api.environnets.com)."
        )
        info.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
        layout.addWidget(info)

        self._input = QLineEdit(current_url)
        self._input.setPlaceholderText("http://oliveirapioreactor01.local")
        layout.addWidget(self._input)

        # Test row
        test_row = QHBoxLayout()
        self._test_btn = QPushButton("Test connection")
        self._test_btn.clicked.connect(self._test)
        self._test_status = QLabel("")
        test_row.addWidget(self._test_btn)
        test_row.addWidget(self._test_status, 1)
        layout.addLayout(test_row)

        # Buttons
        btns = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        btns.accepted.connect(self.accept)
        btns.rejected.connect(self.reject)
        layout.addWidget(btns)

    def get_url(self) -> str:
        return self._input.text().strip().rstrip("/")

    def _test(self):
        url = self.get_url()
        if not url:
            self._test_status.setText("Enter a URL first")
            return
        self._test_status.setText("Testing...")
        self._test_status.setStyleSheet(f"color: {TEXT_SECONDARY};")
        self._test_status.repaint()

        api = PioAPI(url)
        if api.ping():
            workers = api.get_workers()
            active = len([w for w in workers if w.get("is_active")])
            self._test_status.setText(f"Connected. {active} worker(s) active.")
            self._test_status.setStyleSheet(f"color: {GREEN};")
        else:
            self._test_status.setText("Connection failed. Check the address.")
            self._test_status.setStyleSheet(f"color: {RED};")
