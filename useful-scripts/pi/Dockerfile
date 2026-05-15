FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        dnsutils \
        file \
        fd-find \
        git \
        jq \
        less \
        netcat-openbsd \
        openssh-client \
        procps \
        python3 \
        ripgrep \
        tmux \
        tree \
        unzip \
        vim-tiny \
        zip \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @earendil-works/pi-coding-agent

RUN ln -sf /usr/bin/fdfind /usr/local/bin/fd

WORKDIR /workspace
CMD ["pi"]
