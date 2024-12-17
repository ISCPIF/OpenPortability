#!/bin/bash
set -e

# Start PostgreSQL using the original entrypoint
/usr/local/bin/docker-entrypoint.sh postgres "$@" &
pid=$!

# Wait for PostgreSQL to start
until PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U postgres -c '\q'; do
  >&2 echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

>&2 echo "PostgreSQL is up - executing migrations"
/docker-entrypoint-initdb.d/apply-migrations.sh

# Keep the container running
wait $pid