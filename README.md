# FormFriend — Team B Backend (Parts 1–2)

Cloud backend for a hybrid browser autofill system.  
**Authentication** (Cognito) + **Encrypted profile storage** (DynamoDB) + **Redis-cached retrieval** (Upstash).

```
Postman / Browser Extension
         ↓
    Express (local) or API Gateway → Lambda (production)
         ↓
    Controllers → Services
       /     |      \
      ↓      ↓       ↓
   Cognito  Redis   DynamoDB
```

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1 — Set Up AWS Cognito](#step-1--set-up-aws-cognito)
3. [Step 2 — Set Up DynamoDB Table](#step-2--set-up-dynamodb-table)
4. [Step 3 — Set Up Upstash Redis](#step-3--set-up-upstash-redis)
5. [Step 4 — Generate Encryption Key](#step-4--generate-encryption-key)
6. [Step 5 — Configure .env](#step-5--configure-env)
7. [Step 6 — Install & Run](#step-6--install--run)
8. [Step 7 — Test with Postman](#step-7--test-with-postman)
9. [Production Deployment (AWS SAM)](#production-deployment-aws-sam)
10. [Project Structure](#project-structure)
11. [API Reference](#api-reference)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 18+ (recommended 20 LTS) | Runtime |
| **npm** | 9+ | Package manager |
| **AWS Account** | Free tier eligible | Cognito, DynamoDB |
| **AWS CLI** | v2 | Configured with your credentials (`aws configure`) |
| **Postman** | Latest | API testing |

> **Important:** Your local machine needs AWS credentials configured via `aws configure` or environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`). These are **not** stored in the `.env` file — they come from the standard AWS SDK credential chain.

---

## Step 1 — Set Up AWS Cognito

You need a **Cognito User Pool** and an **App Client**.

### Create User Pool

1. Go to **AWS Console** → **Amazon Cognito** → **User Pools**
   - URL: `https://console.aws.amazon.com/cognito/v2/idp/user-pools`
2. Click **Create user pool**
3. Configure sign-in:
   - Sign-in options: **Email**
4. Configure security requirements:
   - Password policy: Keep defaults or customize
   - Multi-factor authentication: **No MFA** (for prototype)
5. Configure sign-up experience:
   - Self-registration: **Enable**
   - Cognito-assisted verification: **Enable** (send verification email)
   - Attributes to verify: **Email**
6. Configure message delivery:
   - Email provider: **Send email with Cognito** (for prototype)
7. Integrate your app:
   - User pool name: `FormFriend-UserPool` (or any name)
   - App client name: `formfriend-client`
   - **Client secret: Do NOT generate a client secret** ← Very important
   - Authentication flows: Enable **`ALLOW_USER_PASSWORD_AUTH`**
8. Click **Create user pool**

### Get the values you need

After creation, find:

| Value | Where to find it | Env variable |
|-------|------------------|--------------|
| **User Pool ID** | User pool → Overview → User pool ID (e.g. `ap-south-1_aBcDeFgHi`) | `COGNITO_USER_POOL_ID` |
| **App Client ID** | User pool → App integration → App clients → Client ID (e.g. `1a2b3c4d5e6f7g8h9i0j`) | `COGNITO_CLIENT_ID` |

---

## Step 2 — Set Up DynamoDB Table

> **Option A (Automatic):** Skip this if you plan to deploy with SAM — the template creates the table for you.
>
> **Option B (Manual — for local development against real DynamoDB):**

1. Go to **AWS Console** → **DynamoDB** → **Tables**
   - URL: `https://console.aws.amazon.com/dynamodbv2/home`
2. Click **Create table**
3. Settings:
   - Table name: **`Profiles`**
   - Partition key: **`userId`** (String)
   - Sort key: Leave empty
   - Table settings: **Customize settings**
   - Read/Write capacity: **Provisioned** → 5 RCU / 5 WCU (free tier)
4. Click **Create table**

| Value | Env variable |
|-------|--------------|
| Table name: `Profiles` | `DYNAMODB_TABLE_NAME` |

---

## Step 3 — Set Up Upstash Redis

1. Go to **https://console.upstash.com/** and sign up / log in
2. Click **Create Database**
3. Settings:
   - Name: `formfriend-cache` (or any name)
   - Region: Choose a region close to your AWS region (e.g. `ap-south-1` or `us-east-1`)
   - Type: **Regional** (free tier)
4. After creation, go to the **Details** tab

### Get the values you need

| Value | Where on Upstash Dashboard | Env variable |
|-------|---------------------------|--------------|
| **REST URL** | Details → REST API → `UPSTASH_REDIS_REST_URL` | `UPSTASH_REDIS_REST_URL` |
| **REST Token** | Details → REST API → `UPSTASH_REDIS_REST_TOKEN` | `UPSTASH_REDIS_REST_TOKEN` |

The URL looks like: `https://YOUR-DB-NAME.upstash.io`  
The token is a long string like: `AYXXAAIjcDE...`

---

## Step 4 — Generate Encryption Key

Run this command in your terminal to generate a random 32-byte AES-256 key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output — it will look like: `k7G8hJ+2...==`

| Value | Env variable |
|-------|--------------|
| Generated Base64 string | `ENCRYPTION_KEY_B64` |

---

## Step 5 — Configure .env

```bash
cd team-b-backend
cp .env.example .env
```

Open `.env` in your editor and fill in ALL the values:

```env
NODE_ENV=development
PORT=3000

AWS_REGION=ap-south-1

# ← Paste your Cognito values from Step 1
COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

DYNAMODB_TABLE_NAME=Profiles

# ← Paste your Upstash values from Step 3
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=AYXXAAIjcDE...

REDIS_PROFILE_TTL_SECONDS=3600

# ← Paste your encryption key from Step 4
ENCRYPTION_KEY_B64=k7G8hJ+2...==

CORS_ORIGIN=*
```

### Checklist — every value must be filled:

- [ ] `COGNITO_USER_POOL_ID` — from AWS Console → Cognito
- [ ] `COGNITO_CLIENT_ID` — from AWS Console → Cognito → App clients
- [ ] `UPSTASH_REDIS_REST_URL` — from Upstash Dashboard → Details
- [ ] `UPSTASH_REDIS_REST_TOKEN` — from Upstash Dashboard → Details
- [ ] `ENCRYPTION_KEY_B64` — generated with the Node.js command above

---

## Step 6 — Install & Run

```bash
cd team-b-backend
npm install
node src/server.js
```

You should see:

```
🚀  FormFriend backend running at http://localhost:3000
   Environment : development
   AWS Region  : ap-south-1
   DynamoDB    : Profiles
   Redis TTL   : 3600s
```

If you see `❌  Missing required environment variables`, check your `.env` file.

---

## Step 7 — Test with Postman

### Import the collection

1. Open **Postman**
2. Click **Import** → select `postman/team-b-backend.postman_collection.json`
3. The collection variable `baseUrl` is already set to `http://localhost:3000`

### Run the test flow

Execute the requests **in order** (they are numbered):

#### 1. Register User
Send **POST /auth/register**. You should get:
```json
{
  "message": "User registered successfully",
  "userConfirmed": false,
  "confirmationRequired": true,
  "codeDeliveryDetails": {
    "destination": "d***@e***.com",
    "medium": "EMAIL"
  }
}
```
→ Check your email for the 6-digit confirmation code.

#### 2. Confirm Email
Replace `"code": "123456"` with the actual code from your email.  
Send **POST /auth/confirm**. You should get:
```json
{
  "message": "Email confirmed successfully. You can now log in."
}
```

#### 3. Login
Send **POST /auth/login**. You should get:
```json
{
  "message": "Login successful",
  "idToken": "eyJraWQiOi...",
  "accessToken": "eyJraWQiOi...",
  "refreshToken": "eyJjdHkiOi...",
  "expiresIn": 3600
}
```

> **The login request has an auto-script** that saves the `idToken` to the Postman collection variable `{{idToken}}` automatically. All subsequent requests use this token in the Authorization header.
>
> If the auto-script doesn't work, **manually copy** the `idToken` value from the response and paste it into the collection variable `idToken`.

#### 4. Save Profile (PUT)
Send **PUT /profile**. The `Authorization: Bearer {{idToken}}` header is pre-configured.
```json
{
  "message": "Profile saved successfully"
}
```

#### 5. Get Profile — First Call (Redis MISS)
Send **GET /profile**. Response will show `"source": "dynamodb"`:
```json
{
  "source": "dynamodb",
  "profile": {
    "name": "Rounak",
    "age": 20,
    "dob": "2006-01-01",
    "email": "demo@example.com",
    "phone": "9999999999"
  }
}
```

#### 6. Get Profile — Second Call (Redis HIT)
Send **GET /profile** again. Response will show `"source": "cache"`:
```json
{
  "source": "cache",
  "profile": {
    "name": "Rounak",
    "age": 20,
    "dob": "2006-01-01",
    "email": "demo@example.com",
    "phone": "9999999999"
  }
}
```

#### 7. Update Profile (PUT)
Send **PUT /profile** with updated data. After this, Redis cache is refreshed.

#### 8. Get Profile — After Update
Send **GET /profile**. Should show the **updated** data (not stale):
```json
{
  "source": "cache",
  "profile": {
    "name": "Rounak Updated",
    "age": 21,
    "dob": "2006-01-01",
    "email": "demo@example.com",
    "phone": "8888888888"
  }
}
```

---

## Production Deployment (AWS SAM)

### Prerequisites

- Install **AWS SAM CLI**: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

### Deploy

```bash
cd team-b-backend

# Build
sam build

# Deploy (guided — first time)
sam deploy --guided
```

SAM will ask for parameter values:

| Parameter | Value |
|-----------|-------|
| Stack name | `formfriend-backend` |
| AWS Region | `ap-south-1` |
| CognitoUserPoolId | Your User Pool ID |
| CognitoClientId | Your App Client ID |
| UpstashRedisRestUrl | Your Upstash REST URL |
| UpstashRedisRestToken | Your Upstash REST Token |
| EncryptionKeyB64 | Your Base64 encryption key |
| RedisProfileTtlSeconds | `3600` |
| CorsOrigin | `*` |

After deployment, SAM outputs the **API Gateway endpoint URL**. Use that as the `baseUrl` in Postman for production testing.

---

## Project Structure

```
team-b-backend/
│
├── src/
│   ├── app.js                          # Express application (shared)
│   ├── server.js                       # Local dev entry point
│   ├── lambda.js                       # AWS Lambda entry point
│   │
│   ├── config/
│   │   └── env.js                      # Environment config loader
│   │
│   ├── routes/
│   │   ├── auth.routes.js              # /auth/* routes
│   │   └── profile.routes.js           # /profile routes
│   │
│   ├── controllers/
│   │   ├── auth.controller.js          # Auth request handlers
│   │   └── profile.controller.js       # Profile request handlers
│   │
│   ├── middleware/
│   │   └── auth.middleware.js          # JWT verification
│   │
│   └── services/
│       ├── cognito.service.js          # Cognito SDK calls
│       ├── dynamodb.service.js         # DynamoDB read/write
│       ├── redis.service.js            # Upstash Redis cache
│       └── encryption.service.js       # AES-256-GCM encryption
│
├── tests/                              # (future test files)
├── postman/
│   └── team-b-backend.postman_collection.json
│
├── template.yaml                       # AWS SAM / CloudFormation
├── package.json
├── .env.example                        # Template — copy to .env
├── .gitignore                          # Prevents committing secrets
└── README.md
```

---

## API Reference

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/auth/register` | Register new user |
| `POST` | `/auth/confirm` | Confirm email |
| `POST` | `/auth/login` | Login, receive tokens |

### Protected Endpoints (require `Authorization: Bearer <idToken>`)

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/profile` | Save / update profile |
| `GET` | `/profile` | Get profile (Redis → DynamoDB) |

---

## Security Notes

- **`.env` is in `.gitignore`** — secrets are never committed
- **Profiles are encrypted** with AES-256-GCM before storage
- **Redis stores encrypted data** — never plaintext profiles
- **JWT verification** happens in the backend using `aws-jwt-verify`
- **No passwords stored** in DynamoDB — Cognito handles all password operations
- **userId comes from JWT `sub`** — never from request body
#   f o r m f r i e n d  
 