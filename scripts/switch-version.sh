#!/bin/bash
# Switch between main and mobile-pwa-redesign versions
# Usage: ./scripts/switch-version.sh [main|mobile]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

show_current() {
    current_branch=$(git branch --show-current)
    echo "Current version: $current_branch"
}

switch_to_main() {
    echo "Switching to main (original desktop version)..."
    git fetch origin
    git checkout main
    git pull origin main
    echo ""
    echo "Rebuilding Docker container..."
    docker compose down
    docker compose up -d --build
    echo ""
    echo "Done! Main version deployed."
    echo "Access at: http://localhost:3000"
}

switch_to_mobile() {
    echo "Switching to mobile-pwa-redesign..."
    git fetch origin
    git checkout mobile-pwa-redesign
    git pull origin mobile-pwa-redesign
    echo ""
    echo "Rebuilding Docker container..."
    docker compose down
    docker compose up -d --build
    echo ""
    echo "Done! Mobile PWA version deployed."
    echo "Access at: http://localhost:3000"
    echo ""
    echo "To install as PWA on Android:"
    echo "1. Open Chrome on your phone"
    echo "2. Navigate to http://YOUR_SERVER_IP:3000"
    echo "3. Tap the menu (3 dots) > 'Add to Home screen'"
}

case "$1" in
    main|desktop|original)
        switch_to_main
        ;;
    mobile|pwa|redesign)
        switch_to_mobile
        ;;
    status|current)
        show_current
        ;;
    *)
        echo "Music League Strategist - Version Switcher"
        echo ""
        show_current
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  main     - Switch to original desktop version"
        echo "  mobile   - Switch to mobile-first PWA version"
        echo "  status   - Show current version"
        echo ""
        echo "Example:"
        echo "  $0 mobile   # Deploy mobile version for testing"
        echo "  $0 main     # Switch back to original version"
        ;;
esac
