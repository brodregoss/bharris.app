#!/bin/bash
# Runs the repo-root opener so this file also works from Finder inside ios/.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$ROOT/Open Last Minute Study in Xcode.command"
