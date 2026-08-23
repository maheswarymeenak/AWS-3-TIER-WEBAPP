# AWS 3-Tier Web Application Architecture

## Project Overview

This project demonstrates the design and deployment of a highly available and scalable AWS 3-Tier Web Application Architecture.

The application follows a three-tier architecture:

- Frontend Layer - User interface hosted on Apache Web Server
- Backend Layer - Application logic developed using Python Flask
- Database Layer - MySQL database hosted on Amazon RDS

The infrastructure is designed using AWS best practices with secure networking, load balancing, auto scaling, and private database access.

---

# AWS Architecture Components

## Amazon VPC

A custom Virtual Private Cloud (VPC) was created to provide a secure networking environment.

Configuration:

- VPC CIDR Block: 10.0.0.0/16
- Multiple Availability Zones
- Public and Private Subnets

---

## Subnets

### Public Subnets

Used for internet-facing resources:

- Frontend EC2 Instances
- Application Load Balancer

### Private Subnets

Used for internal resources:

- Backend EC2 Instances
- Amazon RDS Database

---

## Internet Gateway

Internet Gateway was attached to the VPC to provide internet connectivity to public subnet resources.

It allows users to access the frontend application through the Application Load Balancer.

---

## NAT Gateway

NAT Gateway was configured to provide outbound internet access for private subnet resources.

Backend instances can securely access the internet for updates without being publicly accessible.

---

## Route Tables

Two types of route tables were configured:

### Public Route Table

- Associated with public subnets
- Routes internet traffic through Internet Gateway

### Private Route Table

- Associated with private subnets
- Routes outbound traffic through NAT Gateway

---

# Compute Services

## Amazon EC2

EC2 instances were used to host application components.

### Frontend EC2 Instances

Responsibilities:

- Host HTML, CSS, and JavaScript files
- Run Apache Web Server
- Provide user interface

### Backend EC2 Instances

Responsibilities:

- Run Python Flask application
- Handle application logic and API communication

---

## Launch Template

Launch Templates were created to define EC2 instance configurations.

Includes:

- AMI
- Instance Type
- Security Groups
- Storage Configuration

Launch Templates are used by Auto Scaling Groups to create instances automatically.

---

## Auto Scaling Groups

Auto Scaling Groups were configured to maintain high availability.

Features:

- Automatic instance creation
- Instance replacement
- Improved application reliability
- Scalable infrastructure

---

# Load Balancing

## Application Load Balancer (ALB)

Application Load Balancer was configured to distribute incoming traffic across multiple EC2 instances.

Benefits:

- High availability
- Traffic distribution
- Health monitoring

---

## Target Groups

Target Groups were created to register EC2 instances with Load Balancers.

Configured features:

- Health checks
- Traffic routing
- Instance monitoring

---

# Security Implementation

## Security Groups

Separate security groups were created for different application layers.

### Load Balancer Security Group

Allows:

- HTTP (Port 80)
- HTTPS (Port 443)

---

### Frontend EC2 Security Group

Allows:

- HTTP traffic from Load Balancer
- SSH access for administration

---

### Backend EC2 Security Group

Allows:

- Application traffic from frontend layer only

---

### Database Security Group

Allows:

- MySQL traffic (Port 3306)
- Database access only from backend instances

---

# Database Layer

## Amazon RDS MySQL

Amazon RDS was used as a managed relational database service.

Features:

- Private subnet deployment
- Secure database connectivity
- Managed database infrastructure

Database file:

Database/database.sql

---

# Application Components

## Frontend

Folder:

Frontend/

Files:

- index.html
- style.css
- script.js

Technologies:

- HTML5
- CSS3
- JavaScript

---

## Backend

Folder:

Backend/

File:

- app.py

Technology:

- Python Flask

---

## Database

Folder:

Database/

File:

- database.sql

Technology:

- MySQL

---

# Project Structure

AWS-3tier-WebApp
