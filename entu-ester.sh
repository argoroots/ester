#!/bin/bash

mkdir -p /data/entu-ester/code
cd /data/entu-ester/code

git clone -q https://github.com/argoroots/entu-ester.git ./
git checkout -q master
git pull
printf "\n\n"

version=`date +"%y%m%d.%H%M%S"`
docker build -q -t entu-ester:$version ./ && docker tag -f entu-ester:$version entu-ester:latest
printf "\n\n"

docker stop entu-ester
docker rm entu-ester
docker run -d \
    --name="entu-ester" \
    --restart="always" \
    --memory="512m" \
    --env="PORT=80" \
    --env="NEW_RELIC_APP_NAME=entu-ester" \
    --env="NEW_RELIC_LICENSE_KEY=" \
    --env="NEW_RELIC_LOG=stdout" \
    --env="NEW_RELIC_LOG_LEVEL=error" \
    --env="NEW_RELIC_NO_CONFIG_FILE=true" \
    --env="SENTRY_DSN=" \
    entu-ester:latest

docker inspect -f "{{ .NetworkSettings.IPAddress }}" entu-ester
printf "\n\n"

/data/nginx.sh
