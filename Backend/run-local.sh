#!/usr/bin/env bash
# Loads .env and runs the Spring Boot app (Spring Boot doesn't read .env itself).
# Usage:  ./run-local.sh          (runs the built jar, builds if missing)
#         ./run-local.sh dev      (runs via mvn spring-boot:run)
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "❌ .env not found. Copy .env and fill in your values."
  exit 1
fi

# Export every non-comment var from .env
set -a
# shellcheck disable=SC1091
source .env
set +a

echo "🔧 PORT=$PORT  SOCKETIO_PORT=$SOCKETIO_PORT  MODEL=$GEMINI_MODEL"

if [ "${1:-}" = "dev" ]; then
  mvn spring-boot:run
else
  if [ ! -f target/backend-1.0.0.jar ]; then
    echo "📦 Building jar..."
    mvn -q clean package -DskipTests
  fi
  java -jar target/backend-1.0.0.jar
fi
