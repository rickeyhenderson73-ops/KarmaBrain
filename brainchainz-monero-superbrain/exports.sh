#!/bin/bash

# Monero Superbrain — KarmaBrain Edition
# Connects to Retro Mike XMR Node (must be installed first)

# Network
export SUBNET_ID="212"
export APP_MONERO_SUPERBRAIN_IP="10.21.${SUBNET_ID}.1"
export APP_MONERO_SUPERBRAIN_P2POOL_IP="10.21.${SUBNET_ID}.3"
export APP_MONERO_SUPERBRAIN_PROXY_IP="10.21.${SUBNET_ID}.4"
export APP_MONERO_SUPERBRAIN_XMRIG_IP="10.21.${SUBNET_ID}.5"

# App Proxy
export APP_HOST="dashboard"
export APP_PORT="3000"

# Mining — NO default wallet, user must set their own
export WALLET_ADDRESS="${WALLET_ADDRESS:-}"
export P2POOL_DIFFICULTY="0"
export XMRIG_THREADS="1"

# Retro Mike XMR Node connection
export APP_MONERO_NODE_IP="retro-mike-xmr-node_node_1"
export APP_MONERO_RPC_PORT="9009"
export APP_MONERO_ZMQ_PORT="7009"
export APP_MONERO_RPC_USER=""
export APP_MONERO_RPC_PASS=""

# Umbrel Environment
export APP_DATA_DIR="${APP_DATA_DIR:-$PWD/data}"
export DEVICE_DOMAIN_NAME="${DEVICE_DOMAIN_NAME:-umbrel.local}"
