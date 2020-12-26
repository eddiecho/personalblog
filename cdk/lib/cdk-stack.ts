import * as CodeBuild from '@aws-cdk/aws-codebuild';
import * as CodePipeline from '@aws-cdk/aws-codepipeline';
import * as CodePipelineActions from '@aws-cdk/aws-codepipeline-actions';
import * as Iam from '@aws-cdk/aws-iam';
import * as S3 from '@aws-cdk/aws-s3';
import * as SecretsManager from '@aws-cdk/aws-secretsmanager';
import * as Cdk from '@aws-cdk/core';

interface CdkStackProps extends Cdk.StackProps {
  frontendStackName: string;
  secretArn: string;
}

export class CdkStack extends Cdk.Stack {
  private readonly props: CdkStackProps;
  private readonly sourceOutput = new CodePipeline.Artifact();
  private readonly cdkOutput = new CodePipeline.Artifact();

  constructor(scope: Cdk.Construct, id: string, props: CdkStackProps) {
    super(scope, id, props);
    this.props = props;

    const artifactBucket = new S3.Bucket(this, 'PersonalSitePipelineArtifactBucket', {
      lifecycleRules: [
        {
          enabled: true,
          expiration: Cdk.Duration.days(7),
        },
      ],
    });

    const pipeline = new CodePipeline.Pipeline(this, 'PersonalSitePipeline', {
      artifactBucket: artifactBucket,
      restartExecutionOnUpdate: true,
    });
    pipeline.addStage(this.renderSourceStage());
    pipeline.addStage(this.renderBuildStage());
    pipeline.addStage(this.renderSelfMutateStage());
    pipeline.addStage(this.renderFrontendDeployStage());
  }

  private renderSourceStage = (): CodePipeline.StageProps => {
    const sourceAuthN = SecretsManager.Secret.fromSecretArn(
      this,
      'GithubSecret',
      this.props.secretArn
    ).secretValueFromJson('OAuth');

    return {
      stageName: 'Repository',
      actions: [
        new CodePipelineActions.GitHubSourceAction({
          actionName: 'RepositorySource',
          oauthToken: sourceAuthN,
          output: this.sourceOutput,
          owner: 'eddiecho',
          repo: 'personalblog',
          branch: 'mainline',
        }),
      ],
    };
  };

  private renderCompileCdkProject = (): CodeBuild.PipelineProject => {
    const project = new CodeBuild.PipelineProject(this, 'CompileCdkProject', {
      buildSpec: CodeBuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: ['chmod +x cdk/bin/*'],
          },
          build: {
            commands: ['./cdk/bin/build_cdk.sh'],
          },
        },
        artifacts: {
          'base-directory': 'cdk',
          files: ['cdk.out/**/*'],
        },
      }),
      environment: {
        buildImage: CodeBuild.LinuxBuildImage.STANDARD_4_0,
      },
    });

    const secretPolicy = new Iam.PolicyStatement();
    secretPolicy.addActions('secretsmanager:DescribeSecret');
    secretPolicy.addResources(this.props.secretArn);

    const networkPolicy = new Iam.PolicyStatement();
    networkPolicy.addActions('route53:ListHostedZones');
    networkPolicy.addResources('*');

    project.addToRolePolicy(secretPolicy);
    project.addToRolePolicy(networkPolicy);

    return project;
  };

  private renderBuildStage = (): CodePipeline.StageProps => {
    return {
      stageName: 'Build',
      actions: [
        new CodePipelineActions.CodeBuildAction({
          actionName: 'CompileCDK',
          input: this.sourceOutput,
          outputs: [this.cdkOutput],
          project: this.renderCompileCdkProject(),
        }),
      ],
    };
  };

  private renderSelfMutateStage = (): CodePipeline.StageProps => {
    const cdkChangeSetName = 'CdkChangeSet';

    return {
      stageName: 'SelfMutate',
      actions: [
        new CodePipelineActions.CloudFormationCreateReplaceChangeSetAction({
          actionName: 'PrepareChangeSet',
          stackName: this.stackName,
          changeSetName: cdkChangeSetName,
          adminPermissions: true,
          templatePath: this.cdkOutput.atPath(`cdk.out/${this.stackName}.template.json`),
          runOrder: 1,
        }),
        new CodePipelineActions.CloudFormationExecuteChangeSetAction({
          actionName: 'ExecuteChangeSet',
          stackName: this.stackName,
          changeSetName: cdkChangeSetName,
          runOrder: 2,
        }),
      ],
    };
  };

  private renderFrontendDeployStage = (): CodePipeline.StageProps => {
    const frontendChangeSetName = 'FrontendChangeSet';
    const { frontendStackName } = this.props;

    return {
      stageName: 'FrontendDeploy',
      actions: [
        new CodePipelineActions.CloudFormationCreateReplaceChangeSetAction({
          actionName: 'PrepareChangeSet',
          stackName: frontendStackName,
          changeSetName: frontendChangeSetName,
          adminPermissions: true,
          templatePath: this.cdkOutput.atPath(`cdk.out/${frontendStackName}.template.json`),
          runOrder: 1,
        }),
        new CodePipelineActions.CloudFormationExecuteChangeSetAction({
          actionName: 'ExecuteChangeSet',
          stackName: frontendStackName,
          changeSetName: frontendChangeSetName,
          runOrder: 2,
        }),
      ],
    };
  };
}
