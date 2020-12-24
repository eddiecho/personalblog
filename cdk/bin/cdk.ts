#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import * as Route53 from 'aws-sdk/clients/route53';

import { FrontendStack } from '../lib/frontend-stack';

async function listHostedZones(): Promise<Route53.ListHostedZonesResponse> {
  const route53 = new Route53();
  return route53.listHostedZones().promise();
}

(async function () {
  const domainName = 'eddiecho.io';
  const hostedZones = await listHostedZones();
  const hostedZone = hostedZones.HostedZones.filter(zone => zone.Name.includes(domainName))[0];

  const app = new cdk.App();
  new FrontendStack(app, 'PersonalSiteFrontend', {
    hostedZoneId: hostedZone.Id,
    hostedZoneName: hostedZone.Name,
    domainName: domainName,
  });
})();
