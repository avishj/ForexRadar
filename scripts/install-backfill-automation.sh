#!/usr/bin/env bash
#
# install-backfill-automation.sh
#
# Installs the ForexRadar Mastercard backfill automation as a macOS launchd job.
# Creates the LaunchAgent plist and loads it into launchd.
#
# Usage:
#   ./install-backfill-automation.sh          # Install and load
#   ./install-backfill-automation.sh uninstall # Unload and remove
#
# Schedule: Runs at 9:00 AM, 3:00 PM, and 9:00 PM daily
#

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly PLIST_NAME="com.forexradar.backfill.mastercard"
readonly PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
readonly LOG_DIR="$HOME/Library/Logs/ForexRadar"
readonly WRAPPER_SCRIPT="$SCRIPT_DIR/run_backfill_mastercard.sh"

# Colors
RED='\033[0;91m'
GREEN='\033[0;92m'
YELLOW='\033[0;93m'
CYAN='\033[0;96m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

log_info() { echo -e "${CYAN}[INFO]${RESET} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${RESET} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${RESET} $1"; }
log_error() { echo -e "${RED}[ERROR]${RESET} $1"; }

print_header() {
    echo ""
    echo -e "${BOLD}========================================"
    echo "ForexRadar Backfill Automation Installer"
    echo -e "========================================${RESET}"
    echo ""
}

uninstall() {
    print_header
    log_info "Uninstalling backfill automation..."
    
    # Unload from launchd
    if launchctl list | grep -q "$PLIST_NAME"; then
        log_info "Unloading from launchd..."
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        log_success "Unloaded from launchd"
    else
        log_warn "Not currently loaded in launchd"
    fi
    
    # Remove plist
    if [[ -f "$PLIST_PATH" ]]; then
        rm -f "$PLIST_PATH"
        log_success "Removed plist: $PLIST_PATH"
    else
        log_warn "Plist not found: $PLIST_PATH"
    fi
    
    echo ""
    log_success "Uninstall complete!"
    echo ""
}

install() {
    print_header
    log_info "Installing backfill automation..."
    echo ""
    
    # Verify wrapper script exists and is executable
    if [[ ! -f "$WRAPPER_SCRIPT" ]]; then
        log_error "Wrapper script not found: $WRAPPER_SCRIPT"
        exit 1
    fi
    
    chmod +x "$WRAPPER_SCRIPT"
    chmod +x "$SCRIPT_DIR/backfill_watchdog.py"
    log_success "Made scripts executable"
    
    # Create log directory
    mkdir -p "$LOG_DIR"
    log_success "Created log directory: $LOG_DIR"
    
    # Create LaunchAgents directory if needed
    mkdir -p "$HOME/Library/LaunchAgents"
    
    # Unload existing if present
    if launchctl list 2>/dev/null | grep -q "$PLIST_NAME"; then
        log_info "Unloading existing job..."
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
    fi
    
    # Generate plist
    log_info "Generating launchd plist..."
    cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>${WRAPPER_SCRIPT}</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>${PROJECT_ROOT}</string>
    
    <!-- Run at 9:00 AM, 3:00 PM, and 9:00 PM daily -->
    <key>StartCalendarInterval</key>
    <array>
        <dict>
            <key>Hour</key>
            <integer>2</integer>
            <key>Minute</key>
            <integer>0</integer>
        </dict>
        <dict>
            <key>Hour</key>
            <integer>15</integer>
            <key>Minute</key>
            <integer>0</integer>
        </dict>
        <dict>
            <key>Hour</key>
            <integer>21</integer>
            <key>Minute</key>
            <integer>0</integer>
        </dict>
    </array>
    
    <!-- Logging -->
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchd_stdout.log</string>
    
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchd_stderr.log</string>
    
    <!-- Restart on failure (but not on success) -->
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    
    <!-- Prevent rapid restart loops (5 minute throttle) -->
    <key>ThrottleInterval</key>
    <integer>300</integer>
    
    <!-- Nice priority (lower priority than interactive apps) -->
    <key>Nice</key>
    <integer>10</integer>
    
    <!-- Environment variables -->
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${HOME}/.bun/bin</string>
        <key>HOME</key>
        <string>${HOME}</string>
    </dict>
</dict>
</plist>
EOF
    log_success "Created plist: $PLIST_PATH"
    
    # Load into launchd
    log_info "Loading into launchd..."
    launchctl load "$PLIST_PATH"
    log_success "Loaded into launchd"
    
    # Verify it's loaded
    if launchctl list | grep -q "$PLIST_NAME"; then
        log_success "Verified: job is running in launchd"
    else
        log_warn "Job may not be loaded correctly, check 'launchctl list | grep forexradar'"
    fi
    
    echo ""
    echo -e "${BOLD}Installation Complete!${RESET}"
    echo ""
    echo -e "${DIM}Schedule:${RESET}"
    echo "  • 9:00 AM daily"
    echo "  • 3:00 PM daily"
    echo "  • 9:00 PM daily"
    echo ""
    echo -e "${DIM}Logs:${RESET}"
    echo "  • $LOG_DIR/backfill_mastercard_latest.log"
    echo "  • $LOG_DIR/launchd_stdout.log"
    echo ""
    echo -e "${DIM}Commands:${RESET}"
    echo "  • View status:  launchctl list | grep forexradar"
    echo "  • Run now:      launchctl start $PLIST_NAME"
    echo "  • View logs:    tail -f $LOG_DIR/backfill_mastercard_latest.log"
    echo "  • Uninstall:    $0 uninstall"
    echo ""
}

# Main
case "${1:-install}" in
    uninstall|remove)
        uninstall
        ;;
    install|"")
        install
        ;;
    *)
        echo "Usage: $0 [install|uninstall]"
        exit 1
        ;;
esac
