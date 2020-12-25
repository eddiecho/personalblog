import * as CodeBuild from '@aws-cdk/aws-codebuild';
import * as CodePipeline from '@aws-cdk/aws-codepipeline';
import * as CodePipelineActions from '@aws-cdk/aws-codepipeline-actions';
import * as Iam from '@aws-cdk/aws-iam';
import * as S3 from '@aws-cdk/aws-s3';
import * as SecretsManager from '@aws-cdk/aws-secretsmanager';
import * as Cdk from '@aws-cdk/core';

interface CdkStackProps extends Cdk.StackProps {
  secretArn: string;
}

export class CdkStack extends Cdk.Stack {
  private props: CdkStackProps;

  constructor(scope: Cdk.Construct, id: string, props: CdkStackProps) {
    super(scope, id, props);
    this.props = props;

    const artifactBucket = new S3.Bucket(this, 'PersonalSitePipelineArtifactBucket');

    new CodePipeline.Pipeline(this, 'PersonalSitePipeline', {
      artifactBucket: artifactBucket,
      restartExecutionOnUpdate: true,
      stages: this.renderPipelineStages(),
    });
  }

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

  private renderPipelineStages = (): CodePipeline.StageProps[] => {
    const sourceOutput = new CodePipeline.Artifact();
    const sourceAuthN = SecretsManager.Secret.fromSecretArn(
      this,
      'GithubSecret',
      this.props.secretArn
    ).secretValueFromJson('OAuth');

    const cdkOutput = new CodePipeline.Artifact();

    return [
      {
        stageName: 'Repository',
        actions: [
          new CodePipelineActions.GitHubSourceAction({
            actionName: 'RepositorySource',
            oauthToken: sourceAuthN,
            output: sourceOutput,
            owner: 'eddiecho',
            repo: 'personalblog',
            branch: 'mainline',
          }),
        ],
      },
      {
        stageName: 'Build',
        actions: [
          new CodePipelineActions.CodeBuildAction({
            actionName: 'CompileCDK',
            input: sourceOutput,
            outputs: [cdkOutput],
            project: this.renderCompileCdkProject(),
          }),
        ],
      },
    ];
  };
}
