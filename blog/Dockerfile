FROM public.ecr.aws/amazonlinux/amazonlinux:2
MAINTAINER Eddie Cho <eddie@eddiecho.io>

RUN yum update
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash
RUN source /usr/local/nvm/nvm.sh \
    && nvm install node

RUN node -v
RUN npm -v

RUN npm install

CMD npm run release

