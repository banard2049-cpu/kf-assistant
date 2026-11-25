FROM php:8.4-cli-alpine
WORKDIR /app
COPY public /app/public/
COPY tools /app/tools
RUN if [ -d /app/public/assets ]; then mv /app/public/assets /app/assets; else mkdir /app/assets; fi \
    && ln -s ../assets /app/public/assets \
    && mkdir -p /app/data /app/backups \
    && chown -R www-data:www-data /app/data /app/backups
USER www-data
ENV DATA_DIR=/app/data BACKUP_DIR=/app/backups ALLOW_REGISTRATION=true SESSION_DAYS=30
EXPOSE 8793
VOLUME ["/app/data", "/app/backups"]
CMD ["php", "-S", "0.0.0.0:8793", "-t", "/app/public", "/app/public/docker-router.php"]
