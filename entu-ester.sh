#!/bin/bash

mkdir -p /data/entu-ester/code /data/entu-ester/log /data/entu-ester/tmp
cd /data/entu-ester/code

git clone https://github.com/argoroots/entu-ester.git ./
git checkout master
git pull

version=`date +"%y%m%d.%H%M%S"`

docker build -q -t entu-ester:$version ./ && docker tag -f entu-ester:$version entu-ester:latest
docker kill entu-ester
docker rm entu-ester
docker run -d \
    --name="entu-ester" \
    --restart="always" \
    --memory="256m" \
    --env="PORT=80" \
    --env="NEW_RELIC_APP_NAME=entu-ester" \
    --env="NEW_RELIC_LICENSE_KEY=" \
    --env="NEW_RELIC_LOG=stdout" \
    --env="NEW_RELIC_LOG_LEVEL=error" \
    --env="NEW_RELIC_NO_CONFIG_FILE=true" \
    entu-ester:latest

/data/nginx.sh
