import * as CodePipeline from '@aws-cdk/aws-codepipeline';
import * as CodePipelineActions from '@aws-cdk/aws-codepipeline-actions';
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

    new CodePipeline.Pipeline(this, 'PersonalSitePipeline', {
      restartExecutionOnUpdate: true,
      stages: this.renderPipelineStages(),
    });
  }

  private renderPipelineStages = (): CodePipeline.StageProps[] => {
    const sourceOutput = new CodePipeline.Artifact();
    const sourceAuthN = SecretsManager.Secret.fromSecretArn(
      this,
      'GithubSecret',
      this.props.secretArn
    ).secretValueFromJson('OAuth');

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
    ];
  };
}
