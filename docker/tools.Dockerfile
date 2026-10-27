FROM node:22.23.4-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tar \
 && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /home/tools && chmod 0777 /home/tools
WORKDIR /workspace
