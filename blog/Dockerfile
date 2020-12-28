FROM public.ecr.aws/amazonlinux/amazonlinux:2
MAINTAINER Eddie Cho <eddie@eddiecho.io>

RUN yum update
RUN curl -sL https://rpm.nodesource.com/setup_lts.x | bash -
RUN yum install -y nodejs

RUN node -v
RUN npm -v

RUN npm install

CMD npm run release

