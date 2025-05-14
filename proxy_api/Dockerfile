FROM python:3.9-alpine

# Set working directory
WORKDIR /app

# Install build dependencies for Python packages
RUN apk add --no-cache postgresql-dev gcc python3-dev musl-dev

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN addgroup -g 1000 proxyuser && \
    adduser -D -u 1000 -G proxyuser proxyuser && \
    chown -R proxyuser:proxyuser /app

# Switch to non-root user
USER proxyuser

# Expose the port FastAPI runs on
EXPOSE 8000

# Command to run the application with uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1