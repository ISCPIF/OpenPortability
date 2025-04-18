#!/bin/bash

# Nombre de workers Python à lancer
NUM_WORKERS=2 # Ajustez ce nombre selon vos besoins

# Array pour stocker les PIDs
declare -a PY_WORKER_PIDS=()

echo "Starting ${NUM_WORKERS} Python workers..."

for i in $(seq 1 $NUM_WORKERS); do
  # Définir un ID unique pour chaque worker Python
  export PYTHON_WORKER_ID="pyworker_${i}"

  # Lancer le worker avec npx ts-node au lieu de node
  npx ts-node src/index.ts &

  # Stocker le PID
  PY_WORKER_PIDS+=($!)
  echo "Started Python worker ${i} with ID ${PYTHON_WORKER_ID} and PID ${PY_WORKER_PIDS[-1]}"

  # Petite pause pour éviter de surcharger au démarrage (optionnel)
  sleep 0.5
done

# Fonction pour arrêter proprement les workers
cleanup() {
    echo "Received termination signal. Stopping Python workers..."
    for pid in "${PY_WORKER_PIDS[@]}"; do
        echo "Sending SIGTERM to PID $pid..."
        kill -SIGTERM $pid # Envoyer SIGTERM pour un arrêt gracieux
    done
    # Attendre un peu que les processus se terminent
    sleep 5
    # Forcer l'arrêt si nécessaire (optionnel)
    # for pid in "${PY_WORKER_PIDS[@]}"; do
    #    if kill -0 $pid 2>/dev/null; then
    #        echo "Forcing shutdown for PID $pid..."
    #        kill -SIGKILL $pid
    #    fi
    # done
    echo "Cleanup finished."
    exit 0
}

# Intercepter les signaux d'arrêt (Ctrl+C, etc.)
trap cleanup SIGINT SIGTERM

echo "Waiting for Python workers to complete (Press Ctrl+C to stop)..."
# Attendre que tous les workers se terminent (ou que le script soit interrompu)
for pid in "${PY_WORKER_PIDS[@]}"; do
  wait $pid
done

echo "All Python workers completed naturally."
