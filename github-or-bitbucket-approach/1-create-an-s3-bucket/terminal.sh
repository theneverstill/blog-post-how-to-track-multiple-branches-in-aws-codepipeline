aws cloudformation deploy \
  --template-file template.s3.yml \
  --stack-name example-s3 \
  --parameter-overrides S3BucketNameArtifacts=artifacts.example.com
