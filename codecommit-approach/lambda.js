const AWS = require("aws-sdk");

const CloudFormation = new AWS.CloudFormation({ apiVersion: "2010-05-15" });
const CodeCommit = new AWS.CodeCommit({ apiVersion: "2015-04-13" });

const BRANCH_REF_PREFIX = "refs/heads/";
const BRANCH_SLUG_REGEX = /[\\W_]+/g;
const BRANCH_SLUG_MAX_LENGTH = 63;
const CAPABILITY_IAM = "CAPABILITY_IAM";
const CLOUDFORMATION_PIPELINE_YAML_FILE_PATH = "template.pipeline.yml";
const PARAMETER_KEY_BRANCH = "Branch";
const PARAMETER_KEY_REPOSITORY_NAME = "RepositoryName";
const PARAMETER_KEY_S3_BUCKET_NAME_ARTIFACTS_ARTIFACTS =
  "S3BucketNameArtifacts";

function branchSlugToStackName({ branchSlug }) {
  return `example-codepipeline-${branchSlug}`;
}

function branchSlugToS3BucketName({ branchSlug }) {
  return `${branchSlug}.artifacts.example.com`;
}

function branchToBranchSlug({ branch }) {
  const sanitizedBranchName = branch
    .toLowerCase()
    .replace(BRANCH_SLUG_REGEX, "-");

  let branchSlug = sanitizedBranchName.substring(0, BRANCH_SLUG_MAX_LENGTH);
  while (branchSlug.endsWith("-")) {
    branchSlug = branchSlug.substring(0, branchSlug.length - 1);
  }

  return branchSlug;
}

function getCodeCommitFile({ commitSpecifier, filePath, repositoryName }) {
  return new Promise((resolve, reject) => {
    CodeCommit.getFile(
      {
        filePath,
        repositoryName,
        commitSpecifier,
      },
      function(error, data) {
        if (error) {
          reject(error);
        } else {
          resolve(Buffer.from(data.fileContent, "base64").toString("utf8"));
        }
      },
    );
  });
}

function getCloudFormationPipelineYaml({ branch, repositoryName }) {
  return getCodeCommitFile({
    commitSpecifier: branch,
    filePath: CLOUDFORMATION_PIPELINE_YAML_FILE_PATH,
    repositoryName,
  });
}

function createCloudformationStack({
  branch,
  cloudFormationPipelineYaml,
  repositoryName,
}) {
  return new Promise((resolve, reject) => {
    const branchSlug = branchToBranchSlug({ branch });
    const s3BucketName = branchSlugToS3BucketName({ branchSlug });
    const stackName = branchSlugToStackName({ branchSlug });

    CloudFormation.createStack(
      {
        Capabilities: [CAPABILITY_IAM],
        Parameters: [
          {
            ParameterKey: PARAMETER_KEY_BRANCH,
            ParameterValue: branch,
          },
          {
            ParameterKey: PARAMETER_KEY_REPOSITORY_NAME,
            ParameterValue: repositoryName,
          },
          {
            ParameterKey: PARAMETER_KEY_S3_BUCKET_NAME_ARTIFACTS_ARTIFACTS,
            ParameterValue: s3BucketName,
          },
        ],
        StackName: stackName,
        TemplateBody: cloudFormationPipelineYaml,
      },
      function(error, data) {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      },
    );
  });
}

function deleteCloudformationStack({ stackName }) {
  return new Promise((resolve, reject) => {
    CloudFormation.deleteStack({ StackName: stackName }, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}

function createPipelineCloudformationStack({ branch, repositoryName }) {
  return getCloudFormationPipelineYaml({ branch, repositoryName }).then(
    cloudFormationPipelineYaml =>
      createCloudformationStack({
        branch,
        cloudFormationPipelineYaml,
        repositoryName,
      }),
  );
}

function deletePipelineCloudFormationStack({ branch }) {
  const branchSlug = branchToBranchSlug({ branch });
  const stackName = branchSlugToStackName({ branchSlug });
  return deleteCloudformationStack({ stackName });
}

function onCodeCommitBranchCreation({ branch, repositoryName }) {
  return createPipelineCloudformationStack({ branch, repositoryName });
}

function onCodeCommitBranchDeletion({ branch, repositoryName }) {
  return deletePipelineCloudFormationStack({ branch, repositoryName });
}

exports.handler = (event, context, callback) => {
  const cloudFormationPromises = [];
  for (const record of event.Records) {
    if ("codecommit" in record && "references" in record.codecommit) {
      for (const reference of record.codecommit.references) {
        if (reference.ref.startsWith(BRANCH_REF_PREFIX)) {
          const branch = reference.ref.substring(BRANCH_REF_PREFIX.length);
          const isCreated = reference.created;
          const isDeleted = reference.deleted;
          const repositoryName = record.eventSourceARN.split(":")[5];

          if (isCreated && !isDeleted) {
            cloudFormationPromises.push(
              onCodeCommitBranchCreation({ branch, repositoryName }),
            );
          } else if (isDeleted && !isCreated) {
            cloudFormationPromises.push(
              onCodeCommitBranchDeletion({ branch, repositoryName }),
            );
          }
        }
      }
    }
  }

  Promise.all(cloudFormationPromises)
    .then(() => {
      callback(null);
    })
    .catch(error => {
      console.error(error);
      callback(error);
    });
};
