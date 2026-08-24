KF Unified Assistant Docker Package

Requirements: Docker Desktop or Docker Engine with Docker Compose.

Start:
  docker compose up -d --build

Open:
  http://127.0.0.1:8789/

Stop:
  docker compose down

The package starts with empty data and backups directories. Database files and
backups remain in ./data and ./backups next to this package.

Configuration can be changed in compose.yaml. The default registration policy
is open for trusted local networks; disable ALLOW_REGISTRATION for public use.
