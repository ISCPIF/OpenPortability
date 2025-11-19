group "default" {
  targets = ["app", "worker"]
}

target "app" {
  context = "."
  dockerfile = "Dockerfile.dev"
  tags = ["app"]
}

target "worker" {
  context = "worker"
  dockerfile = "Dockerfile.dev"
  tags = ["worker"]
}
