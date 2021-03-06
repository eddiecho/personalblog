#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import * as Route53 from 'aws-sdk/clients/route53';
import * as SecretsManager from 'aws-sdk/clients/secretsmanager';

import { FrontendStack } from '../lib/frontend-stack';
import { FrontendBuildStack } from '../lib/frontend-build-stack';
import { CdkStack } from '../lib/cdk-stack';

async function listHostedZones(): Promise<Route53.ListHostedZonesResponse> {
  const route53 = new Route53();
  return route53.listHostedZones().promise();
}

async function describeSecret(secretId: string): Promise<SecretsManager.DescribeSecretResponse> {
  const sm = new SecretsManager();
  const request: SecretsManager.DescribeSecretRequest = {
    SecretId: secretId,
  };

  return sm.describeSecret(request).promise();
}

(async function () {
  const domainName = 'eddiecho.io';
  const hostedZones = await listHostedZones();
  const hostedZone = hostedZones.HostedZones.filter(zone => zone.Name.includes(domainName))[0];
  const githubSecret = await describeSecret('GithubPersonalAccessToken');

  const app = new cdk.App();
  const frontend = new FrontendStack(app, 'PersonalSiteFrontend', {
    hostedZoneId: hostedZone.Id,
    hostedZoneName: hostedZone.Name,
    domainName: domainName,
  });

  const frontendBuild = new FrontendBuildStack(app, 'PersonalSiteRender', {
    personalSiteBucket: frontend.assetsBucket,
  });

  new CdkStack(app, 'PersonalSiteCicd', {
    frontendStackName: frontend.stackName,
    secretArn: githubSecret.ARN as string,
//    renderBlogImageRepo: frontendBuild.containerRepo.repositoryName,
  });
})();
