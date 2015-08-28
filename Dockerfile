FROM node:0.12-slim

ADD ./ /usr/src/entu-ester
RUN apt-get update && apt-get install -y libgcrypt11-dev libgnutls28-dev libxml2-dev libxslt-dev dpkg-dev python pkg-config
RUN cd /usr/src/entu-ester && npm install

CMD ["node", "/usr/src/entu-ester/master.js"]
