#!/bin/bash
##############################################################################
# VNC Token Manager - Dynamic websockify token management
# Supports concurrent sandbox creation and automatic token updates
##############################################################################

set -e

TOKEN_FILE="/tmp/vnc_tokens.conf"
LOCK_FILE="/tmp/vnc_tokens.lock"
WEBSOCKIFY_PID_FILE="/tmp/websockify.pid"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Acquire file lock for concurrent safety
acquire_lock() {
    local timeout=10
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        if mkdir "$LOCK_FILE" 2>/dev/null; then
            trap 'release_lock' EXIT
            return 0
        fi
        sleep 0.1
        elapsed=$((elapsed + 1))
    done

    log_error "Failed to acquire lock after ${timeout}s"
    return 1
}

# Release file lock
release_lock() {
    rmdir "$LOCK_FILE" 2>/dev/null || true
}

# Add or update token
add_token() {
    local sandbox_id="$1"
    local vm_ip="$2"

    if [ -z "$sandbox_id" ] || [ -z "$vm_ip" ]; then
        log_error "Usage: $0 add <sandbox_id> <vm_ip>"
        return 1
    fi

    acquire_lock || return 1

    # Create token file if not exists
    if [ ! -f "$TOKEN_FILE" ]; then
        cat > "$TOKEN_FILE" <<'EOF'
# noVNC Token Configuration
# Format: token: target_host:target_port
# Auto-managed by manage-vnc-token.sh
EOF
    fi

    # Remove existing entry for this sandbox_id
    sed -i "/^${sandbox_id}:/d" "$TOKEN_FILE"

    # Add new entry
    echo "${sandbox_id}: ${vm_ip}:5900" >> "$TOKEN_FILE"

    log_info "Token added: ${sandbox_id} -> ${vm_ip}:5900"

    # Reload websockify (send HUP signal)
    reload_websockify

    release_lock
}

# Remove token
remove_token() {
    local sandbox_id="$1"

    if [ -z "$sandbox_id" ]; then
        log_error "Usage: $0 remove <sandbox_id>"
        return 1
    fi

    acquire_lock || return 1

    if [ -f "$TOKEN_FILE" ]; then
        sed -i "/^${sandbox_id}:/d" "$TOKEN_FILE"
        log_info "Token removed: ${sandbox_id}"
        reload_websockify
    fi

    release_lock
}

# List all tokens
list_tokens() {
    if [ -f "$TOKEN_FILE" ]; then
        echo "=== Active VNC Tokens ==="
        grep -v "^#" "$TOKEN_FILE" | grep -v "^$" || echo "No active tokens"
    else
        echo "Token file not found"
    fi
}

# Reload websockify
reload_websockify() {
    # websockify doesn't support HUP signal, so we don't reload
    # Tokens are read on each connection, so no reload needed
    log_info "Token configuration updated (websockify will use new config on next connection)"
}

# Main
case "${1:-}" in
    add)
        add_token "$2" "$3"
        ;;
    remove)
        remove_token "$2"
        ;;
    list)
        list_tokens
        ;;
    *)
        echo "Usage: $0 {add|remove|list} [args...]"
        echo ""
        echo "Commands:"
        echo "  add <sandbox_id> <vm_ip>    Add or update token"
        echo "  remove <sandbox_id>          Remove token"
        echo "  list                         List all tokens"
        echo ""
        echo "Examples:"
        echo "  $0 add icldmuinnpwzr2ez75ijm 10.11.0.9"
        echo "  $0 remove icldmuinnpwzr2ez75ijm"
        echo "  $0 list"
        exit 1
        ;;
esac
