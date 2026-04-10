"""EnvironNets Desktop Application.

Launch with: python -m environnets
"""

import sys
import logging

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt

from environnets.ui.main_window import MainWindow

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("EnvironNets")
    app.setOrganizationName("OliveiraLab")

    # High DPI scaling
    app.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
