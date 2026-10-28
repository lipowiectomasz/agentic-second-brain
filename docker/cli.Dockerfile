FROM node:22.23.4-bookworm-slim
COPY dist/cortex.mjs /usr/local/lib/cortex/cortex.mjs
RUN mkdir -p /home/cortex/.config/cortex && chmod -R 0777 /home/cortex
ENV HOME=/home/cortex
WORKDIR /work
ENTRYPOINT ["node", "/usr/local/lib/cortex/cortex.mjs"]
