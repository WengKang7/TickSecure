FROM node:22-bookworm-slim AS blockchain-node

FROM php:8.3-apache

COPY --from=blockchain-node /usr/local/bin/node /usr/local/bin/node
COPY --from=blockchain-node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

WORKDIR /var/www/html

RUN apt-get update \
    && apt-get install -y --no-install-recommends libcurl4-openssl-dev \
    && docker-php-ext-install curl \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

RUN printf 'upload_max_filesize=11M\npost_max_size=12M\n' > /usr/local/etc/php/conf.d/ticksecure-uploads.ini

COPY . /var/www/html/
RUN cd functions && npm ci --omit=dev --no-audit --no-fund

# Render secret files are mounted at runtime and never included in the image.
ENV TICKSECURE_HOSTED_CHECKOUT=1 \
    TICKSECURE_HOSTED_BLOCKCHAIN=1 \
    TICKSECURE_BLOCKCHAIN_SIGNER_KEY_FILE=/etc/secrets/ticksecure-blockchain-authorizer.json \
    TICKSECURE_DEMO_FUNDING_KEY_FILE=/etc/secrets/ticksecure-demo-funding.json \
    TICKSECURE_DEMO_FUNDING=1 \
    TICKSECURE_HOSTED_BLUEPRINT_UPLOAD=1 \
    TICKSECURE_HOSTED_EVENT_REVIEW=1 \
    TICKSECURE_GEMINI_ENV=/etc/secrets/gemini.env \
    FIREBASE_PROJECT_ID=tick-c12a1 \
    FIREBASE_SERVICE_ACCOUNT_PATH=/etc/secrets/firebase-service-account.json

# Render mounts runtime Secret Files for group 1000. Apache workers must be
# members of that group to read credentials outside the document root.
RUN if ! getent group 1000 >/dev/null; then groupadd --gid 1000 render-secrets; fi \
    && usermod --append --groups 1000 www-data \
    && chown -R www-data:www-data /var/www/html

EXPOSE 80
