FROM php:8.3-apache

WORKDIR /var/www/html

RUN apt-get update \
    && apt-get install -y --no-install-recommends libcurl4-openssl-dev \
    && docker-php-ext-install curl \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

COPY . /var/www/html/

# Render secret files are mounted at runtime and never included in the image.
ENV TICKSECURE_HOSTED_CHECKOUT=1 \
    FIREBASE_PROJECT_ID=tick-c12a1 \
    FIREBASE_SERVICE_ACCOUNT_PATH=/etc/secrets/firebase-service-account.json

RUN chown -R www-data:www-data /var/www/html

EXPOSE 80
