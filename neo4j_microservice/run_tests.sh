#!/usr/bin/env bash
# run_tests.sh
# -----------------
# Script to set up Python environment and run tests for Neo4j microservice

set -euo pipefail

VENV_DIR=".venv"
REQ_FILE="requirements.txt"
ENV_FILE=".env"
TEST_DIR="tests"

echo "🔍 Setting up environment and running tests..."

# 1. Create virtualenv if missing
if [ ! -d "$VENV_DIR" ]; then
  echo " - Creating virtualenv in ${VENV_DIR}/"
  python3 -m venv "$VENV_DIR"
  VENV_CREATED=true
else
  VENV_CREATED=false
fi

# 2. Activate virtualenv
if [ -f "$VENV_DIR/bin/activate" ]; then
  echo " - Activating virtualenv..."
  # shellcheck disable=SC1090
  source "$VENV_DIR/bin/activate"
else
  echo "❌ Error: Virtual environment activation script not found."
  exit 1
fi

# 3. Install dependencies if needed
if [ "$VENV_CREATED" = true ] || [ "$1" = "--force-install" ]; then
  if [ -f "$REQ_FILE" ]; then
    echo " - Installing dependencies from ${REQ_FILE}..."
    pip install -r "$REQ_FILE"
  else
    echo "⚠️ Warning: ${REQ_FILE} not found, installing minimal test dependencies..."
    pip install pytest responses
  fi
fi

# 4. Load environment variables if .env exists
if [ -f "$ENV_FILE" ]; then
  echo " - Loading environment variables from ${ENV_FILE}..."
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
fi

# 5. Run the tests
echo "🧪 Running tests..."
python -m pytest "$TEST_DIR" -v

# 6. Deactivate virtualenv
echo "✅ Tests completed. Deactivating virtualenv."
deactivate