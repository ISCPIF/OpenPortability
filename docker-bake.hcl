# =============================================================================
# Docker Bake Configuration
# =============================================================================
# Usage:
#   Development: docker buildx bake
#   Production:  docker buildx bake prod
# =============================================================================

# -----------------------------------------------------------------------------
# Groups
# -----------------------------------------------------------------------------
group "default" {
  targets = ["app", "worker"]
}

group "prod" {
  targets = ["app-prod", "worker-prod"]
}

# -----------------------------------------------------------------------------
# Development Targets
# -----------------------------------------------------------------------------
target "app" {
  context = "."
  dockerfile = "Dockerfile.dev"
  tags = ["app:dev", "app:latest"]
}

target "worker" {
  context = "worker"
  dockerfile = "Dockerfile.dev"
  tags = ["worker:dev", "worker:latest"]
}

# -----------------------------------------------------------------------------
# Production Targets
# -----------------------------------------------------------------------------
target "app-prod" {
  context = "."
  dockerfile = "Dockerfile.prod"
  tags = ["app:prod"]
}

target "worker-prod" {
  context = "worker"
  dockerfile = "Dockerfile"
  tags = ["worker:prod"]
}


