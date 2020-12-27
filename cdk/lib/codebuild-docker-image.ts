import * as CodeBuild from '@aws-cdk/aws-codebuild';
import * as Iam from '@aws-cdk/aws-iam';
import * as Cdk from '@aws-cdk/core';

interface CodeBuildDockerImageProps {
  imageRepo: string;
  imageTag: string;
  region: string;
  accountId: string;
}

export const renderCodeBuildDockerImage = (scope: Cdk.Construct, props: CodeBuildDockerImageProps) => {
  // these are not supposed to be template strings
  const ecrRepo = '$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com';
  const imageTag = '$IMAGE_REPO:$IMAGE_TAG';

  const project = new CodeBuild.PipelineProject(scope, 'CodeBuildDockerImage', {
    environmentVariables: {
      AWS_DEFAULT_REGION: { value: props.region },
      AWS_ACCOUNT_ID: { value: props.accountId },
      IMAGE_REPO: { value: props.imageRepo },
      IMAGE_TAG: { value: props.imageTag },
    },
    environment: {
      buildImage: CodeBuild.LinuxBuildImage.STANDARD_4_0,
    },
    buildSpec: CodeBuild.BuildSpec.fromObject({
      version: '0.2',
      phases: {
        pre_build: {
          commands: [
            `aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin ${ecrRepo}`,
          ],
        },
        build: {
          commands: [`docker build -t ${imageTag} blog/`, `docker tag ${imageTag} ${ecrRepo}/${imageTag}`],
        },
        /* TODO - uncomment this
        post_build: {
          commands: [`docker push ${ecrRepo}/${imageTag}`],
        },
        */
      },
    }),
  });

  const ecrPolicy = new Iam.PolicyStatement();
  ecrPolicy.addActions('ecr:BatchCheckLayerAvailability');
  ecrPolicy.addActions('ecr:CompleteLayerUpload');
  ecrPolicy.addActions('ecr:GetAuthorizationToken');
  ecrPolicy.addActions('ecr:InitiateLayerUpload');
  ecrPolicy.addActions('ecr:PutImage');
  ecrPolicy.addActions('ecr:UploadLayerPart');
  ecrPolicy.addResources('*');
  project.addToRolePolicy(ecrPolicy);

  return project;
};
