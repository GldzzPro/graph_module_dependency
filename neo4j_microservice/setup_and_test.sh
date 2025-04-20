#!/usr/bin/env bash
# setup_and_test.sh
# -----------------
# Create venv, install deps, load .env, and run tests.

set -euo pipefail

VENV_DIR=".venv"
REQ_FILE="requirements.txt"
ENV_FILE=".env"

echo "🛠️  Setting up Python dev environment..."

# 1. Create virtualenv if missing
if [ ! -d "$VENV_DIR" ]; then
  echo " - Creating virtualenv in ${VENV_DIR}/"
  python3 -m venv "$VENV_DIR"
fi

# 2. Activate it
# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

# 3. Upgrade pip
echo " - Upgrading pip..."
pip install --upgrade pip

# 4. Install dependencies
if [ -f "$REQ_FILE" ]; then
  echo " - Installing from ${REQ_FILE}..."
  pip install -r "$REQ_FILE"
else
  echo " - ${REQ_FILE} not found, installing minimal test deps..."
  pip install requests responses pytest
fi

# 5. Load environment variables from .env via python-dotenv
if [ -f "$ENV_FILE" ]; then
  echo " - Loading environment variables from ${ENV_FILE} via python-dotenv…"
  # This will print out valid export statements for the keys you care about
  eval "$(
    python3 - <<'PYCODE'
import os
from dotenv import load_dotenv
load_dotenv('.env')
# List out only the vars your service uses
for key in ("MODULE_IDS","OPTIONS","ODOO_HOST","NEO4J_URI","NEO4J_USER","NEO4J_PASSWORD"):
    val = os.getenv(key)
    if val is not None:
        # Single-quote the value to preserve JSON syntax
        print(f"export {key}='{val}'")
PYCODE
  )"
else
  echo "⚠️  ${ENV_FILE} not found, skipping env loading."
fi


# 6. Run all tests under tests/
echo "✅ Running pytest against tests/ directory..."
pytest tests
