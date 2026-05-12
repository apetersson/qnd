#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${PI_DOCKER_IMAGE:-pi-coding-agent:latest}"
SOURCE_PATH="${BASH_SOURCE[0]}"
while [[ -L "${SOURCE_PATH}" ]]; do
  SOURCE_DIR="$(cd -- "$(dirname -- "${SOURCE_PATH}")" && pwd)"
  SOURCE_PATH="$(readlink "${SOURCE_PATH}")"
  [[ "${SOURCE_PATH}" != /* ]] && SOURCE_PATH="${SOURCE_DIR}/${SOURCE_PATH}"
done
SCRIPT_DIR="$(cd -- "$(dirname -- "${SOURCE_PATH}")" && pwd)"
WORKSPACE_DIR="${PWD}"
HOST_PI_DIR="${HOME}/.pi"
HOST_CONTAINER_HOME_DIR="${HOME}/.pi-docker-home"
CONTAINER_HOME="/pi-home"
CONTAINER_LAUNCH_DIR="/pi-launch"
HOST_DYNAMIC_MODELS_CONFIG="${SCRIPT_DIR}/dynamic-models.json"
HOST_DYNAMIC_MODELS_EXAMPLE_CONFIG="${SCRIPT_DIR}/dynamic-models.example.json"
CONTAINER_DYNAMIC_MODELS_EXTENSION="${CONTAINER_LAUNCH_DIR}/extensions/pi-dynamic-models"
CONTAINER_DYNAMIC_MODELS_CONFIG="${CONTAINER_LAUNCH_DIR}/dynamic-models.json"
CONTAINER_NPM_PREFIX="${CONTAINER_HOME}/.npm-global"
CONTAINER_PATH="${CONTAINER_NPM_PREFIX}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
CONTAINER_PI_DIR="${CONTAINER_HOME}/.pi"
CONTAINER_AGENT_DIR="${CONTAINER_PI_DIR}/agent"
CONTAINER_WORKSPACE="/workspace"
REBUILD_IMAGE=false

show_help() {
  echo "Usage: $(basename "$0") [--rebuild] [pi args...]"
  echo
  echo "Mounts the current directory at ${CONTAINER_WORKSPACE} inside the container"
  echo "and starts pi interactively."
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rebuild)
      REBUILD_IMAGE=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is required but was not found in PATH." >&2
  exit 1
fi

mkdir -p "${HOST_PI_DIR}/agent" "${HOST_CONTAINER_HOME_DIR}"

if [[ ! -f "${HOST_DYNAMIC_MODELS_CONFIG}" && -f "${HOST_DYNAMIC_MODELS_EXAMPLE_CONFIG}" ]]; then
  cp "${HOST_DYNAMIC_MODELS_EXAMPLE_CONFIG}" "${HOST_DYNAMIC_MODELS_CONFIG}"
  echo "Created ${HOST_DYNAMIC_MODELS_CONFIG} from the example config."
fi

if command -v shasum >/dev/null 2>&1; then
  WORKSPACE_HASH="$(printf '%s' "${WORKSPACE_DIR}" | shasum -a 256 | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  WORKSPACE_HASH="$(printf '%s' "${WORKSPACE_DIR}" | sha256sum | awk '{print $1}')"
else
  echo "Error: shasum or sha256sum is required to derive a session directory." >&2
  exit 1
fi

WORKSPACE_SLUG="$(basename "${WORKSPACE_DIR}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-')"
SESSION_DIR="${CONTAINER_AGENT_DIR}/sessions/docker-${WORKSPACE_SLUG}-${WORKSPACE_HASH:0:12}"

if [[ "${REBUILD_IMAGE}" == "true" ]] || ! docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1; then
  echo "Building Docker image ${IMAGE_NAME}..."
  docker build -t "${IMAGE_NAME}" "${SCRIPT_DIR}"
fi

DOCKER_ARGS=(run --rm --init)

if [[ -t 0 && -t 1 ]]; then
  DOCKER_ARGS+=(-it)
else
  DOCKER_ARGS+=(-i)
fi

DOCKER_ARGS+=(
  --user "$(id -u):$(id -g)"
  --workdir "${CONTAINER_WORKSPACE}"
  --cap-drop ALL
  --security-opt no-new-privileges:true
  --pids-limit 512
  --tmpfs /tmp:rw,nosuid,nodev,noexec,mode=1777
  --mount "type=bind,src=${WORKSPACE_DIR},dst=${CONTAINER_WORKSPACE}"
  --mount "type=bind,src=${HOST_CONTAINER_HOME_DIR},dst=${CONTAINER_HOME}"
  --mount "type=bind,src=${HOST_PI_DIR},dst=${CONTAINER_PI_DIR}"
  --mount "type=bind,src=${SCRIPT_DIR},dst=${CONTAINER_LAUNCH_DIR},readonly"
  --add-host host.docker.internal:host-gateway
  --env "HOME=${CONTAINER_HOME}"
  --env "PATH=${CONTAINER_PATH}"
  --env "USER=${USER:-pi}"
  --env "LOGNAME=${USER:-pi}"
  --env "NPM_CONFIG_PREFIX=${CONTAINER_NPM_PREFIX}"
  --env "NPM_CONFIG_CACHE=${CONTAINER_HOME}/.npm"
  --env "TMPDIR=/tmp"
  --env "PI_CODING_AGENT_DIR=${CONTAINER_AGENT_DIR}"
  --env "PI_DYNAMIC_MODELS_CONFIG=${CONTAINER_DYNAMIC_MODELS_CONFIG}"
)

TERMINAL_ENV_VARS=(
  TERM
  COLORTERM
  TERM_PROGRAM
  TERM_PROGRAM_VERSION
  LANG
  LC_ALL
  LC_CTYPE
  COLORFGBG
  TZ
)

for env_var in "${TERMINAL_ENV_VARS[@]}"; do
  if [[ -n "${!env_var:-}" ]]; then
    DOCKER_ARGS+=(--env "${env_var}")
  fi
done

if [[ -z "${TERM:-}" ]]; then
  DOCKER_ARGS+=(--env "TERM=xterm-256color")
fi

if [[ -f "${HOME}/.gitconfig" ]]; then
  DOCKER_ARGS+=(--mount "type=bind,src=${HOME}/.gitconfig,dst=${CONTAINER_HOME}/.gitconfig,readonly")
fi

if [[ -f "${HOST_DYNAMIC_MODELS_CONFIG}" ]] && command -v python3 >/dev/null 2>&1; then
  HOST_MAPPINGS="$({
    python3 - "${HOST_DYNAMIC_MODELS_CONFIG}" <<'PY'
import json
import socket
import sys
from urllib.parse import urlparse

path = sys.argv[1]

try:
    with open(path, "r", encoding="utf-8") as f:
        config = json.load(f)
except Exception:
    sys.exit(0)

hosts = set()
for endpoint in config.get("endpoints", []):
    if not isinstance(endpoint, dict):
        continue
    for key in ("baseUrl", "modelsUrl"):
        value = endpoint.get(key)
        if not isinstance(value, str):
            continue
        hostname = urlparse(value).hostname
        if hostname and hostname not in {"localhost", "127.0.0.1"}:
            hosts.add(hostname)

for hostname in sorted(hosts):
    try:
        ip = socket.gethostbyname(hostname)
    except Exception:
        continue
    print(f"{hostname} {ip}")
PY
  } || true)"

  while read -r host ip; do
    if [[ -n "${host}" && -n "${ip}" ]]; then
      DOCKER_ARGS+=(--add-host "${host}:${ip}")
    fi
  done <<< "${HOST_MAPPINGS}"
fi

if [[ "${PI_DOCKER_FORWARD_SSH_AGENT:-0}" == "1" && -n "${SSH_AUTH_SOCK:-}" && -S "${SSH_AUTH_SOCK}" ]]; then
  DOCKER_ARGS+=(
    --mount "type=bind,src=${SSH_AUTH_SOCK},dst=/ssh-agent"
    --env "SSH_AUTH_SOCK=/ssh-agent"
  )
fi

PASSTHROUGH_ENV_VARS=(
  ANTHROPIC_API_KEY
  OPENAI_API_KEY
  AZURE_OPENAI_API_KEY
  GOOGLE_API_KEY
  GOOGLE_GENERATIVE_AI_API_KEY
  GEMINI_API_KEY
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_SESSION_TOKEN
  AWS_REGION
  AWS_DEFAULT_REGION
  MISTRAL_API_KEY
  GROQ_API_KEY
  CEREBRAS_API_KEY
  XAI_API_KEY
  OPENROUTER_API_KEY
  VERCEL_AI_GATEWAY_API_KEY
  ZAI_API_KEY
  OPENCODE_ZEN_API_KEY
  OPENCODE_GO_API_KEY
  HUGGINGFACE_API_KEY
  HF_TOKEN
  KIMI_API_KEY
  MINIMAX_API_KEY
  PI_CACHE_RETENTION
  PI_SKIP_VERSION_CHECK
  HTTP_PROXY
  HTTPS_PROXY
  NO_PROXY
)

for env_var in "${PASSTHROUGH_ENV_VARS[@]}"; do
  if [[ -n "${!env_var:-}" ]]; then
    DOCKER_ARGS+=(--env "${env_var}")
  fi
done

DOCKER_ARGS+=(
  "${IMAGE_NAME}"
  pi
  --session-dir "${SESSION_DIR}"
  --extension "${CONTAINER_DYNAMIC_MODELS_EXTENSION}"
)

if [[ $# -gt 0 ]]; then
  DOCKER_ARGS+=("$@")
fi

exec docker "${DOCKER_ARGS[@]}"
