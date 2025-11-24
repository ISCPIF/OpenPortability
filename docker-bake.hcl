group "default" {
  targets = ["app", "worker", "watcher" ]
}

target "app" {
  context = "."
  dockerfile = "Dockerfile.prod"
  tags = ["app"]
}

target "worker" {
  context = "worker"
  dockerfile = "Dockerfile"
  tags = ["worker"]
}

target "watcher" {
  context = "watcher"
  dockerfile = "Dockerfile"
  tags = ["watcher"]
}

