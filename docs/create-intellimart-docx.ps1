$ErrorActionPreference = "Stop"

$outputPath = Join-Path $PSScriptRoot "IntelliMart_System_Architecture.docx"
$workDir = Join-Path $env:TEMP ("intellimart-docx-" + [guid]::NewGuid().ToString("N"))

function Escape-XmlText([string]$value) {
  return [System.Security.SecurityElement]::Escape($value)
}

function New-Paragraph([string]$text, [string]$style = "Normal") {
  $escaped = Escape-XmlText $text
  switch ($style) {
    "Title" {
      return "<w:p><w:pPr><w:jc w:val=`"center`"/><w:spacing w:after=`"240`"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val=`"32`"/></w:rPr><w:t>$escaped</w:t></w:r></w:p>"
    }
    "Heading1" {
      return "<w:p><w:pPr><w:spacing w:before=`"260`" w:after=`"120`"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val=`"28`"/></w:rPr><w:t>$escaped</w:t></w:r></w:p>"
    }
    "Heading2" {
      return "<w:p><w:pPr><w:spacing w:before=`"180`" w:after=`"80`"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val=`"24`"/></w:rPr><w:t>$escaped</w:t></w:r></w:p>"
    }
    "Bullet" {
      return "<w:p><w:pPr><w:ind w:left=`"420`" w:hanging=`"220`"/><w:spacing w:after=`"40`"/></w:pPr><w:r><w:rPr><w:sz w:val=`"22`"/></w:rPr><w:t>- $escaped</w:t></w:r></w:p>"
    }
    "Small" {
      return "<w:p><w:pPr><w:spacing w:after=`"80`"/></w:pPr><w:r><w:rPr><w:sz w:val=`"20`"/></w:rPr><w:t>$escaped</w:t></w:r></w:p>"
    }
    default {
      return "<w:p><w:pPr><w:spacing w:after=`"120`"/><w:jc w:val=`"both`"/></w:pPr><w:r><w:rPr><w:sz w:val=`"22`"/></w:rPr><w:t>$escaped</w:t></w:r></w:p>"
    }
  }
}

$paragraphs = @(
  @{ Text = "IntelliMart: A Serverless Cloud-Based E-Commerce and AWS Learning System"; Style = "Title" },
  @{ Text = "Abstract"; Style = "Heading1" },
  @{ Text = "IntelliMart is a cloud-based, serverless e-commerce web application designed to provide a modern online shopping experience while demonstrating the practical use of cloud computing services. The system allows users to browse products, search and filter the catalogue, view product details, add items to a cart, save products to a wishlist, register or sign in, complete checkout, and view order confirmation and order history. The project is suitable for academic learning because it connects a real storefront interface with realistic cloud services used in modern scalable web applications."; Style = "Normal" },
  @{ Text = "The application is built using TanStack Start, React, TypeScript, and Tailwind CSS. Unlike a traditional web application with a separate backend server or REST API layer, IntelliMart can use TanStack Start server functions directly inside the same application. These server functions act as the backend logic for authentication, product retrieval, cart management, checkout, order processing, payment handling, and notification workflows. This approach keeps the architecture simple while still following a full-stack serverless model."; Style = "Normal" },
  @{ Text = "The proposed AWS architecture uses Amazon CloudFront and AWS Amplify Hosting to deliver the application globally, AWS Lambda to run the TanStack Start server-side runtime and server functions, Amazon DynamoDB to store product, cart, wishlist, order, category, and review data, Amazon Cognito to manage user authentication, Amazon S3 to store static assets and product images, Amazon SES to send transactional emails, AWS Secrets Manager to store payment provider secrets, IAM to control permissions, and Amazon CloudWatch to monitor logs and errors. This architecture avoids unnecessary infrastructure and supports scalability, security, reliability, and cost efficiency for a simple e-commerce project."; Style = "Normal" },
  @{ Text = "IntelliMart demonstrates important cloud computing concepts such as serverless execution, managed NoSQL databases, secure identity management, object storage, CDN-based content delivery, monitoring, access control, and event-driven application design. The system can begin with a small free-tier-friendly AWS setup and later expand with additional services if advanced features are required."; Style = "Normal" },

  @{ Text = "Cloud Services Used"; Style = "Heading1" },
  @{ Text = "The IntelliMart system uses a serverless architecture based on Amazon Web Services. Each cloud service performs a specific role in hosting the application, executing server-side logic, storing data, managing users, sending emails, and monitoring system activity."; Style = "Normal" },

  @{ Text = "1. Amazon CloudFront and AWS Amplify Hosting"; Style = "Heading2" },
  @{ Text = "Amazon CloudFront and AWS Amplify Hosting are used to deploy and deliver the TanStack Start web application. CloudFront acts as a content delivery network that improves performance by serving static files from edge locations close to users. Amplify Hosting can simplify deployment from a Git repository and manage frontend build and hosting workflows."; Style = "Normal" },
  @{ Text = "Role: Web application hosting, global delivery, and frontend deployment."; Style = "Small" },

  @{ Text = "2. AWS Lambda"; Style = "Heading2" },
  @{ Text = "AWS Lambda is used to run the server-side part of the TanStack Start application. TanStack server functions can execute inside the Lambda runtime and perform backend operations such as loading products, calculating cart totals, creating orders, validating checkout data, and interacting with DynamoDB. Lambda removes the need to manage a continuously running server."; Style = "Normal" },
  @{ Text = "Role: Serverless runtime for TanStack Start SSR and server functions."; Style = "Small" },

  @{ Text = "3. Amazon DynamoDB"; Style = "Heading2" },
  @{ Text = "Amazon DynamoDB is used as the primary NoSQL database for the application. It is suitable for IntelliMart because the data model is simple and access patterns are predictable. DynamoDB can store products, categories, reviews, carts, wishlists, orders, and user profile details. It provides fast read and write performance without database server management."; Style = "Normal" },
  @{ Text = "Example data stored in DynamoDB:"; Style = "Small" },
  @{ Text = "Products: product id, name, category, price, stock, images, rating"; Style = "Bullet" },
  @{ Text = "Carts: user id, product ids, quantities, saved-for-later status"; Style = "Bullet" },
  @{ Text = "Wishlists: user id, saved product ids, added date"; Style = "Bullet" },
  @{ Text = "Orders: order id, user id, items, totals, address, payment status, delivery status"; Style = "Bullet" },
  @{ Text = "Role: Cloud database for e-commerce data storage."; Style = "Small" },

  @{ Text = "4. Amazon Cognito"; Style = "Heading2" },
  @{ Text = "Amazon Cognito is used for user authentication and account management. It can replace the current mock login and registration logic with real sign-up, sign-in, password reset, and session handling. Cognito provides secure tokens that can be used by server functions to identify the logged-in user and load user-specific data such as carts, wishlists, and orders."; Style = "Normal" },
  @{ Text = "Role: User registration, login, password reset, and session management."; Style = "Small" },

  @{ Text = "5. Amazon S3"; Style = "Heading2" },
  @{ Text = "Amazon S3 is used for storing static files and media assets. In IntelliMart, S3 can store product images, category images, user-uploaded files, and generated frontend build assets. These files can be served securely and quickly through CloudFront."; Style = "Normal" },
  @{ Text = "Role: Object storage for images, assets, and static files."; Style = "Small" },

  @{ Text = "6. Amazon SES"; Style = "Heading2" },
  @{ Text = "Amazon Simple Email Service is used to send transactional emails from the application. For example, when a user creates an account or places an order, a TanStack server function can trigger an email through SES. SES is more appropriate than sending emails directly from the browser because email credentials and templates should remain on the server side."; Style = "Normal" },
  @{ Text = "Example emails:"; Style = "Small" },
  @{ Text = "Welcome email after registration"; Style = "Bullet" },
  @{ Text = "Password reset email"; Style = "Bullet" },
  @{ Text = "Order confirmation email"; Style = "Bullet" },
  @{ Text = "Shipping update email"; Style = "Bullet" },
  @{ Text = "Role: Transactional email service."; Style = "Small" },

  @{ Text = "7. AWS Secrets Manager"; Style = "Heading2" },
  @{ Text = "AWS Secrets Manager is used to securely store sensitive backend values such as payment provider API keys. In IntelliMart, card or UPI payment integration should be handled inside server functions, and payment secrets must never be exposed in frontend code. Secrets Manager allows Lambda/server functions to retrieve secrets securely when needed."; Style = "Normal" },
  @{ Text = "Role: Secure storage for payment and API secrets."; Style = "Small" },

  @{ Text = "8. AWS Identity and Access Management (IAM)"; Style = "Heading2" },
  @{ Text = "AWS IAM is used to manage permissions between AWS services. IAM policies can allow the Lambda runtime to read and write DynamoDB records, access S3 objects, send emails through SES, write logs to CloudWatch, and read selected secrets from Secrets Manager. IAM ensures that each component receives only the permissions required for its task."; Style = "Normal" },
  @{ Text = "Example permissions:"; Style = "Small" },
  @{ Text = "Lambda to DynamoDB"; Style = "Bullet" },
  @{ Text = "Lambda to S3"; Style = "Bullet" },
  @{ Text = "Lambda to SES"; Style = "Bullet" },
  @{ Text = "Lambda to CloudWatch Logs"; Style = "Bullet" },
  @{ Text = "Lambda to Secrets Manager"; Style = "Bullet" },
  @{ Text = "Role: Security and access management."; Style = "Small" },

  @{ Text = "9. Amazon CloudWatch"; Style = "Heading2" },
  @{ Text = "Amazon CloudWatch is used for monitoring the application. It stores Lambda execution logs, runtime errors, metrics, and alarms. This helps developers identify failed server functions, slow responses, checkout errors, or database-related issues. CloudWatch is important for debugging and maintaining the application after deployment."; Style = "Normal" },
  @{ Text = "Role: Monitoring, logging, error tracking, and performance visibility."; Style = "Small" },

  @{ Text = "10. AWS Certificate Manager and Route 53"; Style = "Heading2" },
  @{ Text = "AWS Certificate Manager provides SSL/TLS certificates for HTTPS when the application is deployed with CloudFront or another supported AWS service. Route 53 can be used if the project requires a custom domain name. For a student project, Route 53 is optional because it adds domain and hosted zone cost, while ACM certificates used with CloudFront are generally free."; Style = "Normal" },
  @{ Text = "Role: HTTPS security and optional custom domain management."; Style = "Small" },

  @{ Text = "Services Not Required Initially"; Style = "Heading1" },
  @{ Text = "Some AWS services are commonly used in large production systems but are not necessary for this simple version of IntelliMart."; Style = "Normal" },
  @{ Text = "Amazon API Gateway is not required initially because TanStack Start server functions can be called directly within the same application architecture."; Style = "Bullet" },
  @{ Text = "Amazon OpenSearch is not required initially because the current catalogue is small and product search can be implemented using DynamoDB queries or simple filtering."; Style = "Bullet" },
  @{ Text = "Amazon SQS and Amazon EventBridge are optional future services for asynchronous order workflows, but direct server function execution is enough for the current project."; Style = "Bullet" },
  @{ Text = "Amazon SNS is optional if SMS notifications are required, but email through SES is enough for the current application."; Style = "Bullet" },
  @{ Text = "AWS WAF is optional for production security but not essential for a small academic deployment."; Style = "Bullet" },

  @{ Text = "Workflow Summary"; Style = "Heading1" },
  @{ Text = "The IntelliMart system integrates multiple AWS services to provide a complete serverless e-commerce workflow."; Style = "Normal" },
  @{ Text = "1. User Access"; Style = "Heading2" },
  @{ Text = "Users open the IntelliMart website through a browser. The application is delivered globally using CloudFront and can be deployed using AWS Amplify Hosting. Static assets and images are served from S3 through CloudFront."; Style = "Normal" },
  @{ Text = "2. Product Browsing"; Style = "Heading2" },
  @{ Text = "Users browse the home page, shop page, category page, deals page, search page, and product detail page. TanStack server functions retrieve product, category, and review data from DynamoDB and return it to the React interface."; Style = "Normal" },
  @{ Text = "3. User Authentication"; Style = "Heading2" },
  @{ Text = "When a user registers, signs in, or requests a password reset, Amazon Cognito handles identity management. The application receives a secure session token that allows server functions to identify the user."; Style = "Normal" },
  @{ Text = "4. Cart and Wishlist Management"; Style = "Heading2" },
  @{ Text = "When the user adds products to the cart or wishlist, server functions store the selected product IDs and quantities in DynamoDB using the Cognito user ID. This replaces localStorage and allows the same cart and wishlist to be available across devices."; Style = "Normal" },
  @{ Text = "5. Checkout and Order Creation"; Style = "Heading2" },
  @{ Text = "During checkout, the user enters shipping details, selects a delivery method, and chooses a payment method. A server function validates the cart, calculates totals, creates a payment intent if a payment provider is connected, and stores the final order record in DynamoDB."; Style = "Normal" },
  @{ Text = "6. Email Confirmation"; Style = "Heading2" },
  @{ Text = "After a successful order, a server function sends an order confirmation email using Amazon SES. The user is redirected to the order confirmation page where the order ID, total amount, delivery estimate, and shipping address are displayed."; Style = "Normal" },
  @{ Text = "7. Monitoring and Logging"; Style = "Heading2" },
  @{ Text = "All important server-side actions such as product loading, checkout, order creation, and email sending can be logged in Amazon CloudWatch. CloudWatch helps detect errors and monitor system behavior."; Style = "Normal" },

  @{ Text = "System Architecture"; Style = "Heading1" },
  @{ Text = "The system architecture follows a simple full-stack serverless flow:"; Style = "Normal" },
  @{ Text = "User -> CloudFront/Amplify Hosting -> TanStack Start application -> AWS Lambda -> TanStack server functions -> DynamoDB, Cognito, S3, SES, Secrets Manager, CloudWatch"; Style = "Small" },
  @{ Text = "This architecture is realistic for the current IntelliMart project because it keeps the frontend and backend logic in the same TanStack Start application. It avoids a separate REST API layer and uses server functions as the backend boundary. DynamoDB is sufficient for the application's simple e-commerce data model, while Cognito, S3, SES, Secrets Manager, IAM, and CloudWatch provide authentication, storage, email, security, permissions, and monitoring."; Style = "Normal" },

  @{ Text = "Conclusion"; Style = "Heading1" },
  @{ Text = "IntelliMart shows how a modern e-commerce application can be built using serverless cloud architecture without managing traditional servers. By using TanStack Start server functions with AWS Lambda and DynamoDB, the project remains simple, scalable, and suitable for academic implementation. The chosen AWS services are practical for the current application features and can operate within a low-cost or free-tier-friendly setup when configured carefully."; Style = "Normal" }
)

New-Item -ItemType Directory -Path $workDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $workDir "_rels") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $workDir "word") | Out-Null

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
'@

$rels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@

$body = ($paragraphs | ForEach-Object { New-Paragraph $_.Text $_.Style }) -join "`n"
$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    $body
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

Set-Content -LiteralPath (Join-Path $workDir "[Content_Types].xml") -Value $contentTypes -Encoding UTF8
Set-Content -LiteralPath (Join-Path $workDir "_rels\.rels") -Value $rels -Encoding UTF8
Set-Content -LiteralPath (Join-Path $workDir "word\document.xml") -Value $documentXml -Encoding UTF8

if (Test-Path -LiteralPath $outputPath) {
  Remove-Item -LiteralPath $outputPath -Force
}

$zipPath = Join-Path $env:TEMP ("intellimart-docx-" + [guid]::NewGuid().ToString("N") + ".zip")
Compress-Archive -Path (Join-Path $workDir "*") -DestinationPath $zipPath -Force
Move-Item -LiteralPath $zipPath -Destination $outputPath -Force
Remove-Item -LiteralPath $workDir -Recurse -Force

"Created $outputPath"
