#!/bin/bash

DIR="${BASH_SOURCE%/*}"
if [[ ! -d "$DIR" ]]; then DIR="$PWD"; fi

NAME_LAMBDA="lambda"
FILENAME_LAMBDA_JS="$NAME_LAMBDA.js"
FILENAME_LAMBDA_ZIP="$NAME_LAMBDA.zip"

PATH_LAMBDA_JS="$DIR/$FILENAME_LAMBDA_JS"
PATH_LAMBDA_ZIP="$DIR/$FILENAME_LAMBDA_ZIP"
PATH_NODE_MODULES="$DIR/node_modules/*"
PATH_TEMPLATE_BASE_YML="$DIR/template.base.yml"

REPOSITORY_NAME="example-repository"
S3_BUCKET_NAME_ARTIFACTS="artifacts.example.com"
S3_BUCKET_PATH_ARTIFACTS="s3://$S3_BUCKET_NAME_ARTIFACTS"
S3_KEY_NAME_LAMBDA="$RANDOM$RANDOM$RANDOM/$FILENAME_LAMBDA_ZIP"

NODE_ENV=production npm install -q

zip -9qry "$DIR/lambda.zip" "./" -i "$PATH_LAMBDA_JS" "$PATH_NODE_MODULES"

# Create a temporary bucket for artifacts
aws s3 mb "$S3_BUCKET_PATH_ARTIFACTS"
aws s3 cp "$PATH_LAMBDA_ZIP" "$S3_BUCKET_PATH_ARTIFACTS/$FILENAME_LAMBDA_ZIP"

aws cloudformation deploy \
  --template-file "$PATH_TEMPLATE_BASE_YML" \
  --stack-name example-codecommit \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides S3BucketNameArtifacts="$S3_BUCKET_NAME_ARTIFACTS" S3KeyNameLambda="$S3_KEY_NAME_LAMBDA" RepositoryName="$REPOSITORY_NAME"

aws s3 rm "$S3_BUCKET_PATH_ARTIFACTS" --recursive
aws s3 rb "$S3_BUCKET_PATH_ARTIFACTS"
