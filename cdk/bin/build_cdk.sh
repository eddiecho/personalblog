#!/bin/bash

set -xe

pushd cdk
npm install
npm run cdk synth
