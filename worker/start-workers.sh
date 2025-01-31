#!/bin/bash

# Workers pour les followers
export JOB_TYPES=followers

export WORKER_ID=worker1_followers
npx ts-node src/index.ts &
WORKER1_FOLLOWERS_PID=$!

export WORKER_ID=worker2_followers
npx ts-node src/index.ts &
WORKER2_FOLLOWERS_PID=$!

export WORKER_ID=worker3_followers
npx ts-node src/index.ts &
WORKER3_FOLLOWERS_PID=$!

export WORKER_ID=worker4_followers
npx ts-node src/index.ts &
WORKER4_FOLLOWERS_PID=$!

export WORKER_ID=worker5_followers
npx ts-node src/index.ts &
WORKER5_FOLLOWERS_PID=$!

export WORKER_ID=worker6_followers
npx ts-node src/index.ts &
WORKER6_FOLLOWERS_PID=$!

export WORKER_ID=worker7_followers
npx ts-node src/index.ts &
WORKER7_FOLLOWERS_PID=$!

export WORKER_ID=worker8_followers
npx ts-node src/index.ts &
WORKER8_FOLLOWERS_PID=$!

# Workers pour les following
export JOB_TYPES=following

export WORKER_ID=worker1_following
npx ts-node src/index.ts &
WORKER1_FOLLOWING_PID=$!

export WORKER_ID=worker2_following
npx ts-node src/index.ts &
WORKER2_FOLLOWING_PID=$!

export WORKER_ID=worker3_following
npx ts-node src/index.ts &
WORKER3_FOLLOWING_PID=$!

export WORKER_ID=worker4_following
npx ts-node src/index.ts &
WORKER4_FOLLOWING_PID=$!

export WORKER_ID=worker5_following
npx ts-node src/index.ts &
WORKER5_FOLLOWING_PID=$!

# Attendre que tous les workers se terminent
wait $WORKER1_FOLLOWERS_PID
wait $WORKER2_FOLLOWERS_PID
wait $WORKER3_FOLLOWERS_PID
wait $WORKER4_FOLLOWERS_PID
wait $WORKER5_FOLLOWERS_PID
wait $WORKER6_FOLLOWERS_PID
wait $WORKER7_FOLLOWERS_PID
wait $WORKER8_FOLLOWERS_PID
wait $WORKER1_FOLLOWING_PID
wait $WORKER2_FOLLOWING_PID
wait $WORKER3_FOLLOWING_PID
wait $WORKER4_FOLLOWING_PID
wait $WORKER5_FOLLOWING_PID