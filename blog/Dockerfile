FROM node:current-alpine3.10

RUN curl "https://s3.amazonaws.com/aws-cli/awscli-bundle.zip" -o "awscli-bundle.zip"
    && unzip awscli-bundle.zip
    && ./awscli-bundle/install -i /usr/local/aws -b /usr/local/bin/aws
RUN npm install

CMD npm run release

