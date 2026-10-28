#!/bin/bash
# One command to install Zalo on a new Linux machine, or update an existing
# installation from the project's GitHub repository.
#
#   curl -fsSL https://raw.githubusercontent.com/RuriMeiko/zalo-linux-native/main/update.sh -o /tmp/zalo-update.sh
#   bash /tmp/zalo-update.sh
#
# or, from a checkout:
#
#   bash update.sh              # install, or update to the newest main
#   bash update.sh --check      # only report whether an update exists
#   bash update.sh --rollback   # undo the last update
#   bash update.sh --ref NAME   # use a branch or tag other than main
#
# This is a thin wrapper: all payload work is done by the verified scripts in
# the repository (scripts/update-native.mjs for updates, install.sh for a first
# install). The repository is trusted as code, exactly like a git clone.
set -euo pipefail

ZALO_REMOTE='https://github.com/RuriMeiko/zalo-linux-native.git'
ZALO_REPO_DIR="$HOME/zalo-linux-native"
ZALO_INSTALL_DIR="$HOME/.local/share/zalo"
ZALO_REF='main'

MODE='update'
while [[ $# -gt 0 ]]; do
    case "$1" in
        --check) MODE='check'; shift ;;
        --rollback) MODE='rollback'; shift ;;
        --ref)
            [[ $# -ge 2 ]] || { echo 'ERROR: --ref needs a branch or tag name.' >&2; exit 2; }
            ZALO_REF="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *) echo "ERROR: unknown option '$1' (try --help)." >&2; exit 2 ;;
    esac
done

die() { echo "ERROR: $*" >&2; exit 1; }
step() { printf '\n>>> %s\n' "$*"; }

# --- prerequisites --------------------------------------------------------
[[ "$(uname -s)" == 'Linux' && "$(uname -m)" == 'x86_64' ]] || \
    die 'Zalo currently supports Linux x86_64 only.'
command -v node >/dev/null 2>&1 || die 'Node.js 18, 20 or 22 is required.'
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
(( NODE_MAJOR >= 18 && NODE_MAJOR <= 22 )) || \
    die "Node.js 18, 20 or 22 is required (found $(node --version))."
command -v git >/dev/null 2>&1 || die 'git is required.'

# --- locate or fetch the project checkout --------------------------------
# The checkout is the source of truth: the installed payload is a verified copy
# of one commit, and updates are produced from this checkout.
cd -- "$HOME"
if [[ ! -d "$ZALO_REPO_DIR/.git" ]]; then
    step "Fetching the project into $ZALO_REPO_DIR"
    git clone --branch "$ZALO_REF" "$ZALO_REMOTE" "$ZALO_REPO_DIR"
else
    step "Updating $ZALO_REPO_DIR"
    git -C "$ZALO_REPO_DIR" fetch --quiet --prune origin "$ZALO_REF"
    # Never reset a tree that holds local work: this checkout may be somebody's
    # editing directory. A dirty tree is used as-is and only reported.
    if [[ -n "$(git -C "$ZALO_REPO_DIR" status --porcelain)" ]]; then
        echo "Note: $ZALO_REPO_DIR has local changes; using it as-is." >&2
    else
        git -C "$ZALO_REPO_DIR" checkout --quiet --detach "origin/$ZALO_REF"
    fi
fi
PROJECT_DIR="$ZALO_REPO_DIR"

# --- no installation yet: do a first install -----------------------------
if [[ ! -f "$ZALO_INSTALL_DIR/launch-installed.sh" ]]; then
    [[ "$MODE" == 'check' ]] && { echo 'Zalo is not installed; run without --check to install.'; exit 10; }
    [[ "$MODE" == 'rollback' ]] && die 'Zalo is not installed; there is nothing to roll back.'
    step 'No installation found; installing'
    exec bash "$PROJECT_DIR/install.sh"
fi

# --- already installed: update through the verified updater --------------
cd -- "$PROJECT_DIR"
UPDATER="$PROJECT_DIR/scripts/update-native.mjs"
[[ -f "$UPDATER" ]] || die "The project checkout is incomplete ($UPDATER missing)."

ARGS=(--app-dir "$ZALO_INSTALL_DIR" --repo "$ZALO_REMOTE" --ref "$ZALO_REF")
case "$MODE" in
    check)    step 'Checking for an update'; ARGS+=(--check) ;;
    rollback) step 'Rolling back the last update'; ARGS+=(--rollback) ;;
    update)   step 'Installing the newest version' ;;
esac

# update-native.mjs exit codes:
#   0  up to date / updated successfully
#  10  an update is available (--check only)
#   3  Zalo is running, close it first
#   2  usage error
#   1  failure
set +e
node "$UPDATER" "${ARGS[@]}"
CODE=$?
set -e
case "$CODE" in
    0)  [[ "$MODE" == 'update' ]] && echo 'Done.' ;;
    10) echo 'An update is available. Run this command again without --check to install it.' ;;
    3)  echo 'Zalo is running. Quit it from the tray, then run this command again.' >&2 ;;
    *)  die "Update failed (exit $CODE). The previous installation was kept." ;;
esac
exit "$CODE"
