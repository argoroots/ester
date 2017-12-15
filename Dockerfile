FROM ubuntu:devel

ADD ./ /usr/src/entu-ester

RUN apt-get update && apt-get install -y nodejs npm libyaz5-dev
RUN cd /usr/src/entu-ester && npm --silent --production install

CMD ["node", "/usr/src/entu-ester/master.js"]
