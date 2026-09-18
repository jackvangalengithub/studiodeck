FROM php:8.4-cli
WORKDIR /srv/fakestripe
COPY *.php ./
COPY start.sh ./
RUN mkdir /data && chown www-data:www-data /data
USER www-data
EXPOSE 8200
CMD ["sh", "start.sh"]
