variable "s3_data_bucket_name" {
  description = "The name of the S3 bucket for data"
  type        = string
  default     = "rc-laptimes-uploads"  # Adjust this name as needed
}

variable "s3_public_bucket_name" {
  description = "The name of the S3 bucket for the public website"
  type        = string
  default     = "rc-laptimes-website"  # Adjust this name as needed
}

variable "website_content_path" {
  description = "Path to the directory containing the website content"
  type        = string
  default     = "../public"  # Adjust this to match your project structure
}

variable "lambda_function_path" {
  description = "Path to the Lambda function zip file"
  type        = string
  default     = "../serve_data_lambda.zip"  # Adjust this path as needed
}

variable "api_gateway_name" {
  description = "The name of the API Gateway"
  type        = string
  default     = "rc-laptimes-api"  # Adjust this name as needed
}

variable "process_data_lambda_path" {
  description = "Path to the process_data Lambda function zip file"
  type        = string
  default     = "../process_data_lambda.zip"
}

variable "aws_region" {
  description = "The AWS region to deploy resources to"
  type        = string
  default     = "ap-southeast-2"
}
