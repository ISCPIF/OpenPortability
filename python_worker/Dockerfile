# python_worker/Dockerfile
FROM node:20-alpine

RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Install Python and pip
RUN apk add --no-cache python3 py3-pip bash

# Create Python virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app

# First, copy only package files to leverage Docker cache
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup tsconfig.json ./

# Install Node.js dependencies
RUN npm install

# Then copy the rest of the application
COPY --chown=appuser:appgroup . .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

RUN chown -R appuser:appgroup /app

USER appuser

# Build TypeScript
RUN npm run build

# Make Python scripts executable
RUN chmod +x *.py
RUN chmod +x start-py-workers.sh

# Environment variables
ENV PYTHON_WORKER_ID="python-worker-01"
ENV PYTHON_WORKER_POLLING_INTERVAL=5000
ENV PYTHON_WORKER_STALLED_TASK_TIMEOUT=300000
ENV NODE_ENV=production

CMD ["/bin/bash", "./start-py-workers.sh"]