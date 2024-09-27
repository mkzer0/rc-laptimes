# Existing S3 bucket for data (if not already present)
resource "aws_s3_bucket" "data_bucket" {
  bucket = var.s3_data_bucket_name

  tags = {
    Name        = "data_bucket"
    Environment = "Production"
  }
}

# Create an S3 bucket for the website
resource "aws_s3_bucket" "public_bucket" {
  bucket = var.s3_public_bucket_name

  tags = {
    Name        = "public_bucket"
    Environment = "Production"
  }
}

# Configure bucket ownership
resource "aws_s3_bucket_ownership_controls" "public_bucket" {
  bucket = aws_s3_bucket.public_bucket.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

# Configure public access block
resource "aws_s3_bucket_public_access_block" "public_bucket" {
  bucket = aws_s3_bucket.public_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Configure the bucket for website hosting
resource "aws_s3_bucket_website_configuration" "public_bucket" {
  bucket = aws_s3_bucket.public_bucket.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }
}

# Set up a bucket policy to make specific content publicly accessible
resource "aws_s3_bucket_policy" "public_read" {
  bucket = aws_s3_bucket.public_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = [
          "${aws_s3_bucket.public_bucket.arn}/*.html",
          "${aws_s3_bucket.public_bucket.arn}/*.jpg",
          "${aws_s3_bucket.public_bucket.arn}/*.jpeg",
          "${aws_s3_bucket.public_bucket.arn}/*.json"
        ]
      },
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.public_bucket]
}

# Upload HTML files to S3
resource "aws_s3_object" "object_upload_html" {
  for_each     = fileset("${var.website_content_path}", "*.html")
  bucket       = aws_s3_bucket.public_bucket.bucket
  key          = each.value
  source       = "${var.website_content_path}/${each.value}"
  content_type = "text/html"
  etag         = filemd5("${var.website_content_path}/${each.value}")
}

# Upload JPEG files to S3
resource "aws_s3_object" "object_upload_jpg" {
  for_each     = fileset("${var.website_content_path}", "*.{jpg,jpeg}")
  bucket       = aws_s3_bucket.public_bucket.bucket
  key          = each.value
  source       = "${var.website_content_path}/${each.value}"
  content_type = "image/jpeg"
  etag         = filemd5("${var.website_content_path}/${each.value}")
}

# Lambda function
resource "aws_lambda_function" "serve_and_upload_data" {
  filename         = var.lambda_function_path
  function_name    = "serve_and_upload_data"
  role             = aws_iam_role.lambda_role.arn
  handler          = "app.lambdaHandler"
  runtime          = "nodejs18.x"
  source_code_hash = filebase64sha256(var.lambda_function_path)

  environment {
    variables = {
      ALLOWED_ORIGIN      = aws_s3_bucket_website_configuration.public_bucket.website_endpoint
      S3_BUCKET_NAME      = var.s3_data_bucket_name
      WEBSITE_ENDPOINT    = aws_s3_bucket_website_configuration.public_bucket.website_endpoint
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.laptimes_table.name
    }
  }
}

# IAM role for the Lambda function
resource "aws_iam_role" "lambda_role" {
  name = "lambda_serve_and_upload_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for Lambda to access S3
resource "aws_iam_role_policy_attachment" "lambda_s3_policy_attachment" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
  role       = aws_iam_role.lambda_role.name
}

# IAM policy for Lambda to access DynamoDB
resource "aws_iam_role_policy_attachment" "lambda_dynamodb_read_policy_attachment" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBReadOnlyAccess"
  role       = aws_iam_role.lambda_role.name
}

# API Gateway
resource "aws_api_gateway_rest_api" "main" {
  name        = var.api_gateway_name
  description = "API Gateway for rc-laptimes"
}

# API Gateway Resource
resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "{proxy+}"
}

# GET method
resource "aws_api_gateway_method" "proxy_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "proxy_get" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.serve_and_upload_data.invoke_arn
}

# POST method
resource "aws_api_gateway_method" "proxy_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "proxy_post" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.serve_and_upload_data.invoke_arn
}

resource "aws_api_gateway_integration_response" "proxy_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.proxy_post.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'http://${aws_s3_bucket_website_configuration.public_bucket.website_endpoint}'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST'"
  }

  depends_on = [
    aws_api_gateway_method.proxy_post,
    aws_api_gateway_integration.proxy_post
  ]
}

# CORS Configuration
resource "aws_api_gateway_method" "options_method" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_integration" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.options_method.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "options_200" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.options_method.http_method
  status_code = "200"
  
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.options_method.http_method
  status_code = aws_api_gateway_method_response.options_200.status_code
  
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST'"
    "method.response.header.Access-Control-Allow-Origin"  = "'http://${aws_s3_bucket_website_configuration.public_bucket.website_endpoint}'"
  }
}

# Method Responses for GET and POST
resource "aws_api_gateway_method_response" "proxy_method_response" {
  for_each    = toset(["GET", "POST"])
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = each.key
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
  }

  depends_on = [
    aws_api_gateway_method.proxy_get,
    aws_api_gateway_method.proxy_post,
    aws_api_gateway_integration.proxy_get,
    aws_api_gateway_integration.proxy_post
  ]
}

# Integration Responses for GET and POST
resource "aws_api_gateway_integration_response" "proxy_integration_response" {
  for_each    = toset(["GET", "POST"])
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = each.key
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'http://${aws_s3_bucket_website_configuration.public_bucket.website_endpoint}'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST'"
  }

  depends_on = [
    aws_api_gateway_method.proxy_get,
    aws_api_gateway_method.proxy_post,
    aws_api_gateway_integration.proxy_get,
    aws_api_gateway_integration.proxy_post,
    aws_api_gateway_method_response.proxy_method_response
  ]
}

# Deployment
resource "aws_api_gateway_deployment" "main" {
  depends_on = [
    aws_api_gateway_integration.proxy_post,
    aws_api_gateway_integration.options_integration,
    aws_api_gateway_integration_response.options_integration_response,
    aws_api_gateway_integration_response.proxy_post
  ]
  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = "prod"
}

# Lambda permission
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.serve_and_upload_data.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# Create config.json file
resource "local_file" "config_json" {
  content  = jsonencode({
    API_GATEWAY_URL = aws_api_gateway_deployment.main.invoke_url
    WEBSITE_URL     = "http://${aws_s3_bucket_website_configuration.public_bucket.website_endpoint}"
  })
  filename = "${var.website_content_path}/config.json"
}

# Upload config.json to S3
resource "aws_s3_object" "config_json" {
  bucket       = aws_s3_bucket.public_bucket.id
  key          = "config.json"
  content_type = "application/json"
  content      = local_file.config_json.content

  # Remove the etag attribute
}

# Use terraform_data to trigger updates when config.json changes
resource "terraform_data" "config_json_trigger" {
  input = local_file.config_json.content

  triggers_replace = [
    aws_s3_object.config_json.id
  ]
}

# Add these resources after your existing configuration

# DynamoDB table for lap times
resource "aws_dynamodb_table" "laptimes_table" {
  name           = "LapTimes"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "RaceId"
  range_key      = "LapTimestamp"

  attribute {
    name = "RaceId"
    type = "S"
  }

  attribute {
    name = "LapTimestamp"
    type = "N"
  }

  attribute {
    name = "DriverName"
    type = "S"
  }

  global_secondary_index {
    name               = "DriverNameIndex"
    hash_key           = "DriverName"
    range_key          = "LapTimestamp"
    projection_type    = "ALL"
  }
}

# Lambda function for processing uploaded data
resource "aws_lambda_function" "process_uploaded_data" {
  filename         = var.process_data_lambda_path
  function_name    = "process_uploaded_data"
  role             = aws_iam_role.lambda_role.arn
  handler          = "process_data.lambdaHandler"
  runtime          = "nodejs18.x"
  source_code_hash = filebase64sha256(var.process_data_lambda_path)

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.laptimes_table.name
    }
  }
}

# S3 bucket notification to trigger Lambda
resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.data_bucket.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.process_uploaded_data.arn
    events              = ["s3:ObjectCreated:*"]
  }
}

# Lambda permission for S3
resource "aws_lambda_permission" "allow_bucket" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.process_uploaded_data.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.data_bucket.arn
}

# IAM policy for Lambda to access DynamoDB
resource "aws_iam_role_policy_attachment" "lambda_dynamodb_policy_attachment" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
  role       = aws_iam_role.lambda_role.name
}
