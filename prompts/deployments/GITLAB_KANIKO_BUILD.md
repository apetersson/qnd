# GitLab CI + Kaniko Container Build

Standard pattern for building and publishing Docker images via Kaniko in GitLab CI, shared across multiple projects.

## Structure

```yaml
stages:
  - verify
  - publish

workflow:
  rules:
    - if: $CI_COMMIT_TAG
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: never
    - if: $CI_COMMIT_BRANCH && $CI_OPEN_MERGE_REQUESTS
      when: never
    - if: $CI_COMMIT_BRANCH

variables:
  KANIKO_IMAGE: gcr.io/kaniko-project/executor:v1.23.2-debug

default:
  interruptible: true
```

## Verify Stage (Node)

```yaml
.node:
  image: node:22-bookworm
  tags:
    - docker
  before_script:
    - npm ci

verify:typecheck:
  stage: verify
  extends: .node
  script:
    - npm run typecheck

verify:build:
  stage: verify
  extends: .node
  script:
    - npm run build
```

## Publish Stage (Kaniko)

```yaml
.kaniko:
  image:
    name: $KANIKO_IMAGE
    entrypoint: [""]
  tags:
    - docker
  before_script:
    - mkdir -p /kaniko/.docker
    - cat > /kaniko/.docker/config.json <<EOF
      {"auths":{"${CI_REGISTRY}":{"username":"${CI_REGISTRY_USER}","password":"${CI_REGISTRY_PASSWORD}"}}}
      EOF

publish:tag:
  stage: publish
  extends: .kaniko
  script:
    - /kaniko/executor
      --context "${CI_PROJECT_DIR}"
      --dockerfile "${CI_PROJECT_DIR}/Dockerfile"
      --cache=true
      --cache-copy-layers
      --cache-repo "${CI_REGISTRY_IMAGE}/cache"
      --reproducible
      --destination "${CI_REGISTRY_IMAGE}:${CI_COMMIT_SHORT_SHA}"
      --destination "${CI_REGISTRY_IMAGE}:latest"
      --destination "${CI_REGISTRY_IMAGE}:${CI_COMMIT_TAG}"
  rules:
    - if: '$CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/'
```

## Key Points

- **Kaniko** builds Docker images rootlessly (no Docker-in-Docker required).
- **Cache repo** (`${CI_REGISTRY_IMAGE}/cache`) stores intermediate layers between builds.
- **Triple tagging**: short SHA, `latest`, and semver tag.
- **Semver gate**: only tags matching `vX.Y.Z` trigger the publish stage.
- **Build args**: inject version info via `--build-arg` when needed (e.g. `FRONTEND_BUILD_VERSION`, `API_BUILD_VERSION`).
- The `.node` and `.kaniko` templates are copy-pasted across projects — consider extracting to a shared CI template.

## Dockerfile (Dual-Stage)

```dockerfile
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

ARG BUILD_VERSION=dev
RUN printf '{"version":"%s"}\n' "${BUILD_VERSION}" > ./dist/build-info.json

EXPOSE 3001
CMD ["npm", "run", "start"]
```

## Trigger Rules

- **On tag** (`vX.Y.Z`): verify + publish to registry.
- **On MR**: verify only (no publish).
- **On branch without MR**: skip entirely (avoids double runs when MR exists).
