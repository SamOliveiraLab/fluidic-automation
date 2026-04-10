PYTHON ?= python3
VENV   := venv
BIN    := $(VENV)/bin

.PHONY: setup run dev clean build

setup:
	$(PYTHON) -m venv $(VENV)
	$(BIN)/pip install --upgrade pip
	$(BIN)/pip install -r requirements.txt
	$(BIN)/pip install -e .
	@echo ""
	@echo "Setup complete. Run with: make run"

run:
	$(BIN)/python -m environnets

dev:
	$(BIN)/pip install -e .
	$(BIN)/python -m environnets

clean:
	rm -rf $(VENV) build dist *.egg-info __pycache__
	find . -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
	find . -name '*.pyc' -delete 2>/dev/null || true

build:
	$(BIN)/pip install pyinstaller
	$(BIN)/pyinstaller --name EnvironNets \
		--windowed \
		--onedir \
		--add-data "config.json:." \
		environnets/__main__.py
