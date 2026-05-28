#!/bin/sh
# OUM Core — Colors and UI

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[1;36m'
BOLD='\033[1m'
NC='\033[0m'

err() { echo -e "${RED}✗ $1${NC}"; }
ok() { echo -e "${GREEN}✓ $1${NC}"; }
inf() { echo -e "${BLUE}ℹ $1${NC}"; }
wrn() { echo -e "${YELLOW}⚠ $1${NC}"; }
hdr() { echo -e "${BOLD}${CYAN}$1${NC}"; }
