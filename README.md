# medicojob-api-gateway

This repository contains the api-gateway microservice.

## CI

The CI pipeline runs SonarQube first, then Snyk.

## Docker

After a merged PR has the uild label, the Docker pipeline builds, scans, and pushes to GHCR.