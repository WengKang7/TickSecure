FROM php:8.3-apache

WORKDIR /var/www/html

RUN apt-get update \
    && apt-get install -y --no-install-recommends libcurl4-openssl-dev \
    && docker-php-ext-install curl \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

RUN printf 'upload_max_filesize=6M\npost_max_size=8M\n' > /usr/local/etc/php/conf.d/ticksecure-uploads.ini

COPY . /var/www/html/

# Render secret files are mounted at runtime and never included in the image.
ENV TICKSECURE_HOSTED_CHECKOUT=1 \
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
