#!/bin/bash

# Worker de reconnexion automatique
export WORKER_ID=reconnect_worker1
npx ts-node src/index.ts &
WORKER_PID=$!

# Attendre que le worker se termine
wait $WORKER_PID