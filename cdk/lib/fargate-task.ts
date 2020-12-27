import * as Ecr from '@aws-cdk/aws-ecr';
import * as Ecs from '@aws-cdk/aws-ecs';
import * as Iam from '@aws-cdk/aws-iam';
import * as Cdk from '@aws-cdk/core';

interface FargateTaskProps {
  taskRolePolicies: Iam.PolicyStatement[];
}

export class FargateTask extends Cdk.Construct {
  public readonly containerRepo: Ecr.IRepository;
  public readonly cluster: Ecs.ICluster;
  public readonly taskDefinition: Ecs.TaskDefinition;
  public readonly taskContainerName = 'main';

  constructor(scope: Cdk.Construct, id: string, props: FargateTaskProps) {
    super(scope, id);

    this.containerRepo = new Ecr.Repository(scope, `${id}Repo`);

    const taskRole = new Iam.Role(scope, `${id}TaskRole`, {
      assumedBy: new Iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        executionPolicy: new Iam.PolicyDocument({
          statements: props.taskRolePolicies,
        }),
      },
    });

    this.taskDefinition = new Ecs.FargateTaskDefinition(scope, `${id}TaskDef`, {
      taskRole,
    });
    this.taskDefinition.addContainer(this.taskContainerName, {
      image: Ecs.ContainerImage.fromEcrRepository(this.containerRepo, 'latest'),
    });

    this.cluster = new Ecs.Cluster(scope, 'Cluster', {
      clusterName: `${id}BuildCluster`,
      containerInsights: true,
    });
  }
}
