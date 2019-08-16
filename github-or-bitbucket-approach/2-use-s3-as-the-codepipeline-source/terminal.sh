aws cloudformation deploy \
  --template-file template.codepipeline.yml \
  --stack-name example-codepipeline \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides S3BucketNameArtifacts=artifacts.example.com S3KeyNameSource=source.zip
