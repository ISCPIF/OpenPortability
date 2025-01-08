#!/bin/bash

# Worker 1 - Gère les followers
export WORKER_ID=worker1
export JOB_TYPES=followers
npx ts-node src/index.ts &
WORKER1_PID=$!

# Worker 2 - Gère les following
export WORKER_ID=worker2
export JOB_TYPES=following
npx ts-node src/index.ts &
WORKER2_PID=$!

# Attendre que les deux workers se terminent
wait $WORKER1_PID
wait $WORKER2_PID