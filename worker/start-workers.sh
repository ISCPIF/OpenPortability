#!/bin/bash

# Arrays to store PIDs
declare -a FOLLOWER_PIDS=()
declare -a FOLLOWING_PIDS=()

# Workers pour les followers
export JOB_TYPES=followers

for i in {1..10}; do
  export WORKER_ID=worker${i}_followers
  npx ts-node src/index.ts &
  FOLLOWER_PIDS+=($!)
  echo "Started follower worker $i with PID ${FOLLOWER_PIDS[-1]}"
done

# Workers pour les following
export JOB_TYPES=following

for i in {1..10}; do
  export WORKER_ID=worker${i}_following
  npx ts-node src/index.ts &
  FOLLOWING_PIDS+=($!)
  echo "Started following worker $i with PID ${FOLLOWING_PIDS[-1]}"
done

# Attendre que tous les workers se terminent
echo "Waiting for follower workers..."
for pid in "${FOLLOWER_PIDS[@]}"; do
  wait $pid
done

echo "Waiting for following workers..."
for pid in "${FOLLOWING_PIDS[@]}"; do
  wait $pid
done

echo "All workers completed"