import * as Acm from '@aws-cdk/aws-certificatemanager';
import * as Cloudfront from '@aws-cdk/aws-cloudfront';
import * as Route53 from '@aws-cdk/aws-route53';
import * as Route53Targets from '@aws-cdk/aws-route53-targets';
import * as S3 from '@aws-cdk/aws-s3';
import * as Cdk from '@aws-cdk/core';

interface FrontendStackProps extends Cdk.StackProps {
  hostedZoneId: string;
  hostedZoneName: string;
  domainName: string;
}

export class FrontendStack extends Cdk.Stack {
  public readonly assetsBucket: S3.IBucket;

  constructor(app: Cdk.App, name: string, props: FrontendStackProps) {
    super(app, name, props);

    const hostedZone = Route53.HostedZone.fromHostedZoneAttributes(this, 'SiteHostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.hostedZoneName,
    });

    const originAccessIdentity = new Cloudfront.OriginAccessIdentity(this, 'SiteOAI');
    this.assetsBucket = new S3.Bucket(this, 'AssetsBucket', {
      websiteIndexDocument: 'index.html',
    });
    this.assetsBucket.grantRead(originAccessIdentity);

    const cert = new Acm.Certificate(this, 'SiteCert', {
      domainName: `*.${props.domainName}`,
      validationMethod: Acm.ValidationMethod.DNS,
      subjectAlternativeNames: [`www.${props.domainName}`, props.domainName],
    });

    const cdn = new Cloudfront.CloudFrontWebDistribution(this, 'CDN', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: this.assetsBucket,
            originAccessIdentity: originAccessIdentity,
          },
          behaviors: [
            {
              compress: true,
              isDefaultBehavior: true,
              defaultTtl: Cdk.Duration.minutes(10),
            },
          ],
        },
      ],
      viewerCertificate: Cloudfront.ViewerCertificate.fromAcmCertificate(cert, {
        aliases: [`www.${props.domainName}`, props.domainName],
      }),
      priceClass: Cloudfront.PriceClass.PRICE_CLASS_100,
      viewerProtocolPolicy: Cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });

    new Route53.ARecord(this, 'ApexRecord', {
      target: Route53.RecordTarget.fromAlias(new Route53Targets.CloudFrontTarget(cdn)),
      zone: hostedZone,
    });

    // i suppose you could use a CNAME record, but apparently Route53 charges more for those
    new Route53.ARecord(this, 'WWWRecord', {
      target: Route53.RecordTarget.fromAlias(new Route53Targets.CloudFrontTarget(cdn)),
      zone: hostedZone,
      recordName: `www.${props.domainName}`,
    });
  }
}
