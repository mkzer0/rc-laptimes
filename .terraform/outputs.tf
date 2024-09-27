output "api_gateway_url" {
  value       = aws_api_gateway_deployment.main.invoke_url
  description = "The URL of the API Gateway"
}

output "public_bucket_website_endpoint" {
  value       = "http://${aws_s3_bucket_website_configuration.public_bucket.website_endpoint}"
  description = "The website endpoint for the public S3 bucket"
}
