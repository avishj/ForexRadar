#!/usr/bin/env python3
"""
Backfill Watchdog

Robust process supervisor for ForexRadar backfill operations.
Monitors child process output and restarts on hangs or crashes.

Features:
- Hang detection: kills process if no output for HANG_TIMEOUT seconds
- Crash recovery: restarts up to MAX_RESTARTS times per invocation
- Process group killing: terminates all Playwright child processes
- Lock file: prevents overlapping runs
- Auto-commit: commits and pushes changes with signoff on success

Usage:
    python3 backfill_watchdog.py --provider mastercard --days 160
"""

import os
import sys
import signal
import subprocess
import time
import fcntl
import argparse
from datetime import datetime
from pathlib import Path

# Configuration
HANG_TIMEOUT = 900  # 15 minutes in seconds
MAX_RESTARTS = 3
KILL_GRACE_PERIOD = 15  # seconds to wait after SIGTERM before SIGKILL

# Paths
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent
LOCK_DIR = Path("/tmp/forexradar-backfill.lock")
LOG_DIR = Path.home() / "Library" / "Logs" / "ForexRadar"

# Git commit config
COMMIT_MSG = "data: mc update"
COMMIT_AUTHOR = "Avish <avish.j@protonmail.com>"


class Colors:
    """ANSI color codes for terminal output."""
    RESET = "\033[0m"
    BOLD = "\033[1m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    DIM = "\033[2m"


def log(msg: str, level: str = "info") -> None:
    """Print timestamped log message with color."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    colors = {
        "info": Colors.CYAN,
        "success": Colors.GREEN,
        "warn": Colors.YELLOW,
        "error": Colors.RED,
        "dim": Colors.DIM,
    }
    color = colors.get(level, Colors.RESET)
    prefix = f"{Colors.DIM}[{timestamp}]{Colors.RESET}"
    print(f"{prefix} {color}{msg}{Colors.RESET}", flush=True)


def acquire_lock() -> bool:
    """
    Acquire exclusive lock using mkdir (atomic on POSIX).
    Returns True if lock acquired, False if already locked.
    """
    try:
        LOCK_DIR.mkdir(parents=True, exist_ok=False)
        # Write PID for debugging
        (LOCK_DIR / "pid").write_text(str(os.getpid()))
        return True
    except FileExistsError:
        # Check if the locking process is still alive
        pid_file = LOCK_DIR / "pid"
        if pid_file.exists():
            try:
                old_pid = int(pid_file.read_text().strip())
                os.kill(old_pid, 0)  # Check if process exists
                return False  # Process still running
            except (ValueError, ProcessLookupError, PermissionError):
                # Stale lock, remove and retry
                log("Removing stale lock from dead process", "warn")
                release_lock()
                return acquire_lock()
        return False


def release_lock() -> None:
    """Release the lock by removing the lock directory."""
    try:
        (LOCK_DIR / "pid").unlink(missing_ok=True)
        LOCK_DIR.rmdir()
    except (FileNotFoundError, OSError):
        pass


def kill_process_group(pid: int) -> None:
    """
    Kill entire process group to terminate Playwright and browser children.
    Sends SIGTERM first, waits, then SIGKILL if needed.
    """
    try:
        pgid = os.getpgid(pid)
        log(f"Sending SIGTERM to process group {pgid}", "warn")
        os.killpg(pgid, signal.SIGTERM)
        
        # Wait for graceful termination
        time.sleep(KILL_GRACE_PERIOD)
        
        # Check if still alive and force kill
        try:
            os.killpg(pgid, 0)  # Check if exists
            log(f"Process group still alive, sending SIGKILL", "error")
            os.killpg(pgid, signal.SIGKILL)
        except ProcessLookupError:
            pass  # Already dead
            
    except ProcessLookupError:
        pass  # Process already dead
    except PermissionError as e:
        log(f"Permission error killing process: {e}", "error")


def run_backfill(provider: str, days: int, log_file: Path) -> tuple[bool, int]:
    """
    Run the backfill command with output monitoring.
    
    Returns:
        (success: bool, exit_code: int)
    """
    cmd = ["bun", "run", "backfill", "--", f"--provider={provider}", f"--days={days}"]
    log(f"Executing: {' '.join(cmd)}", "info")
    
    last_output_time = time.time()
    
    with open(log_file, "a") as lf:
        lf.write(f"\n{'='*60}\n")
        lf.write(f"Run started: {datetime.now().isoformat()}\n")
        lf.write(f"Command: {' '.join(cmd)}\n")
        lf.write(f"{'='*60}\n\n")
        lf.flush()
        
        # Start process in new session for process group control
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=PROJECT_ROOT,
            start_new_session=True,
            bufsize=1,
            universal_newlines=True,
        )
        
        try:
            while True:
                # Non-blocking read with select
                import select
                ready, _, _ = select.select([proc.stdout], [], [], 1.0)
                
                if ready:
                    line = proc.stdout.readline()
                    if line:
                        last_output_time = time.time()
                        print(line, end="", flush=True)
                        lf.write(line)
                        lf.flush()
                    elif proc.poll() is not None:
                        # Process ended and no more output
                        break
                else:
                    # Timeout on select, check for hang
                    elapsed_silent = time.time() - last_output_time
                    
                    if elapsed_silent > HANG_TIMEOUT:
                        log(f"No output for {int(elapsed_silent)}s, killing process", "error")
                        kill_process_group(proc.pid)
                        lf.write(f"\n[WATCHDOG] Killed due to hang after {int(elapsed_silent)}s\n")
                        return False, -1
                    
                    # Check if process died
                    if proc.poll() is not None:
                        break
            
            # Get final exit code
            exit_code = proc.wait()
            lf.write(f"\n[WATCHDOG] Process exited with code {exit_code}\n")
            
            return exit_code == 0, exit_code
            
        except Exception as e:
            log(f"Error monitoring process: {e}", "error")
            kill_process_group(proc.pid)
            return False, -1


def has_changes() -> bool:
    """Check if there are uncommitted changes in the db/ directory."""
    result = subprocess.run(
        ["git", "status", "--porcelain", "db/"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    return bool(result.stdout.strip())


def commit_and_push() -> bool:
    """Commit changes with signoff and push to remote."""
    if not has_changes():
        log("No changes to commit", "dim")
        return True
    
    log("Staging db/ changes...", "info")
    result = subprocess.run(
        ["git", "add", "db/"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log(f"git add failed: {result.stderr}", "error")
        return False
    
    log(f"Committing: {COMMIT_MSG}", "info")
    result = subprocess.run(
        ["git", "commit", "-m", COMMIT_MSG, "-s", f"--author={COMMIT_AUTHOR}"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log(f"git commit failed: {result.stderr}", "error")
        return False
    
    log("Pushing to remote...", "info")
    result = subprocess.run(
        ["git", "push"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log(f"git push failed: {result.stderr}", "error")
        return False
    
    log("Changes committed and pushed successfully", "success")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill watchdog with hang detection")
    parser.add_argument("--provider", required=True, help="Provider (visa/mastercard)")
    parser.add_argument("--days", type=int, required=True, help="Number of days to backfill")
    args = parser.parse_args()
    
    # Setup logging
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = LOG_DIR / f"backfill_{args.provider}_{timestamp}.log"
    latest_log = LOG_DIR / f"backfill_{args.provider}_latest.log"
    
    print()
    log(f"{Colors.BOLD}ForexRadar Backfill Watchdog{Colors.RESET}", "info")
    log(f"Provider: {args.provider} | Days: {args.days}", "info")
    log(f"Hang timeout: {HANG_TIMEOUT}s | Max restarts: {MAX_RESTARTS}", "dim")
    log(f"Log file: {log_file}", "dim")
    print()
    
    # Acquire lock
    if not acquire_lock():
        log("Another instance is already running, exiting", "warn")
        return 1
    
    try:
        # Create symlink to latest log
        latest_log.unlink(missing_ok=True)
        latest_log.symlink_to(log_file)
        
        attempt = 0
        success = False
        
        while attempt < MAX_RESTARTS and not success:
            attempt += 1
            log(f"Attempt {attempt}/{MAX_RESTARTS}", "info")
            
            success, exit_code = run_backfill(args.provider, args.days, log_file)
            
            if success:
                log(f"Backfill completed successfully", "success")
            else:
                log(f"Backfill failed (exit code: {exit_code})", "error")
                if attempt < MAX_RESTARTS:
                    log(f"Restarting in 30 seconds...", "warn")
                    time.sleep(30)
        
        if not success:
            log(f"All {MAX_RESTARTS} attempts failed", "error")
            return 1
        
        # Commit and push on success
        if not commit_and_push():
            log("Failed to commit/push changes", "error")
            return 1
        
        log("All done!", "success")
        return 0
        
    finally:
        release_lock()


if __name__ == "__main__":
    sys.exit(main())
