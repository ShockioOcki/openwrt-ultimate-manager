#!/bin/sh
# OUM v8.0 — OpenWrt Ultimate Manager

OUM_VERSION="8.0.0"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
NC='\033[0m'

header() {
    clear
    echo -e "${CYAN}==================================================${NC}"
    echo -e "${GREEN}        OUM v${OUM_VERSION} — OpenWrt Ultimate Manager        ${NC}"
    echo -e "${CYAN}==================================================${NC}"
}

header
echo "Hello from OUM v${OUM_VERSION}!"
echo "Project scaffold ready."
