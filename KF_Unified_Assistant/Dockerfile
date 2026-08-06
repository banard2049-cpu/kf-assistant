FROM php:8.4-apache
RUN docker-php-ext-install pdo_sqlite
WORKDIR /var/www
COPY public /var/www/html
COPY tools /var/www/tools
RUN mkdir -p /var/www/data /var/www/backups \
    && chown -R www-data:www-data /var/www/data /var/www/backups
ENV DATA_DIR=/var/www/data BACKUP_DIR=/var/www/backups ALLOW_REGISTRATION=true SESSION_DAYS=30
EXPOSE 80
VOLUME ["/var/www/data", "/var/www/backups"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD php -r "$$d=@json_decode(file_get_contents('http://127.0.0.1/api.php?route=health'),true);exit(($$d['ok']??false)?0:1);"
