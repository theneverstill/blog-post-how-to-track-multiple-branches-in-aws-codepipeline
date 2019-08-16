aws cloudformation deploy \
  --template-file template.codebuild.yml \
  --stack-name example-codebuild \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides S3BucketNameArtifacts=artifacts.example.com S3KeyNameSource=source.zip RepositoryType=GITHUB RepositoryLocation=https://github.com/example/example.git
