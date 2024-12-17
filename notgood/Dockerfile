FROM supabase/postgres:15.1.0.147

# Create directory for migrations and scripts
WORKDIR /docker-entrypoint-initdb.d

# Copy migrations
COPY migrations/*.sql /docker-entrypoint-initdb.d/

# Create a script to apply migrations
RUN echo '#!/bin/bash\n\
for file in /docker-entrypoint-initdb.d/*.sql; do\n\
    echo "Applying migration: $file"\n\
    psql -U $POSTGRES_USER -d $POSTGRES_DB -f "$file"\n\
done' > /docker-entrypoint-initdb.d/apply-migrations.sh \
    && chmod +x /docker-entrypoint-initdb.d/apply-migrations.sh

# Set the entrypoint to run migrations after PostgreSQL starts
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]