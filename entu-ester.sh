#!/bin/bash

mkdir -p /data/ester/code
cd /data/ester/code

git clone -q https://github.com/argoroots/entu-ester.git ./
git checkout -q master
git pull

printf "\n\n"
version=`date +"%y%m%d.%H%M%S"`
docker build --pull --tag=ester:$version ./ && docker tag ester:$version ester:latest

printf "\n\n"
docker stop ester
docker rm ester
docker run -d \
    --net="entu" \
    --name="ester" \
    --restart="always" \
    --cpu-shares=256 \
    --memory="1g" \
    --env="NODE_ENV=production" \
    --env="VERSION=$version" \
    --env="PORT=80" \
    --env="NEW_RELIC_APP_NAME=ester" \
    --env="NEW_RELIC_LICENSE_KEY=" \
    --env="NEW_RELIC_LOG=stdout" \
    --env="NEW_RELIC_LOG_LEVEL=error" \
    --env="NEW_RELIC_NO_CONFIG_FILE=true" \
    --env="SENTRY_DSN=" \
    ester:latest

printf "\n\n"
docker exec nginx /etc/init.d/nginx reload
