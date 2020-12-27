import * as Ecr from '@aws-cdk/aws-ecr';
import * as Ecs from '@aws-cdk/aws-ecs';
import * as EventTargets from '@aws-cdk/aws-events-targets';
import * as Iam from '@aws-cdk/aws-iam';
import * as S3 from '@aws-cdk/aws-s3';
import * as Cdk from '@aws-cdk/core';

import { FargateTask } from './fargate-task';

interface FrontendBuildStackProps extends Cdk.StackProps {
  personalSiteBucket: S3.IBucket;
}

export class FrontendBuildStack extends Cdk.Stack {
  public readonly containerRepo: Ecr.IRepository;

  constructor(scope: Cdk.Construct, id: string, props: FrontendBuildStackProps) {
    super(scope, id, props);

    const markdownStorageBucket = new S3.Bucket(this, 'MarkdownStorageBucket');

    const taskPolicies = [
      new Iam.PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [props.personalSiteBucket.bucketArn, props.personalSiteBucket.arnForObjects('*')],
        effect: Iam.Effect.ALLOW,
      }),
    ];
    const fargateTask = new FargateTask(this, 'NextJsRender', {
      taskRolePolicies: taskPolicies,
    });
    this.containerRepo = fargateTask.containerRepo;

    markdownStorageBucket.onCloudTrailPutObject('OnPublish', {
      target: new EventTargets.EcsTask({
        cluster: fargateTask.cluster,
        taskDefinition: fargateTask.taskDefinition,
        platformVersion: Ecs.FargatePlatformVersion.LATEST,
        containerOverrides: [
          {
            cpu: 2048,
            memoryLimit: 2048,
            containerName: fargateTask.taskContainerName,
            environment: [
              { name: 'OUTPUT_BUCKET', value: props.personalSiteBucket.bucketName },
              { name: 'AWS_DEFAULT_REGION', value: this.region },
              { name: 'AWS_ACCOUNT_ID', value: this.account },
              { name: 'IMAGE_TAG', value: 'latest' },
              { name: 'IMAGE_REPO', value: fargateTask.containerRepo.repositoryName },
            ],
          },
        ],
      }),
    });
  }
}
