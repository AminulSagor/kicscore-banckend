# Kicscore Backend API Test Docs

This document matches the current backend controllers:

- `AuthController` under `/auth`
- `UsersController` under `/users`
- `FilesController` under `/files`

The S3 flow is private-bucket based:

```txt
Keep bucket private
Keep IAM policy
Keep CORS
Use signed upload URL
Use signed read URL
No publicUrl
```

---

## 1. Postman Environment Variables

Create a Postman environment or use the collection variables:

```txt
baseUrl=http://localhost:5000
fullName=John Doe
email=john@example.com
password=Password123
otp=1234

accessToken=
fileId=
fileKey=
uploadUrl=
readUrl=

uploadFileName=profile.jpg
uploadContentType=image/jpeg
uploadSizeBytes=250000
uploadFolder=profile-photos
```

For development OTP bypass, backend `.env` can be:

```env
NODE_ENV=development
BYPASS_EMAIL=true
BYPASS_OTP=1234
```

---

## 2. Standard API Response Format

All backend responses are wrapped by your response interceptor.

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {},
  "timestamp": "2026-05-10T00:00:00.000Z",
  "path": "/api/path"
}
```

### Error Response

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid or expired OTP",
  "data": null,
  "timestamp": "2026-05-10T00:00:00.000Z",
  "path": "/auth/verify-email"
}
```

---

# 3. Auth APIs

## 3.1 Register

```http
POST {{baseUrl}}/auth/register
```

Body:

```json
{
  "fullName": "{{fullName}}",
  "email": "{{email}}",
  "password": "{{password}}"
}
```

Expected response:

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Account created successfully. Please verify your email.",
  "data": {
    "email": "john@example.com",
    "requiresVerification": true
  },
  "timestamp": "2026-05-10T00:00:00.000Z",
  "path": "/auth/register"
}
```

Backend behavior:

```txt
Creates pending registration only
Does not create real user yet
Sends/saves OTP
If same email tries again before verification, pending registration is updated
```

---

## 3.2 Verify Email

```http
POST {{baseUrl}}/auth/verify-email
```

Body:

```json
{
  "email": "{{email}}",
  "otp": "{{otp}}"
}
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verified successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "fullName": "John Doe",
      "role": "USER"
    },
    "token": {
      "accessToken": "jwt-token",
      "tokenType": "Bearer",
      "expiresIn": "7d"
    }
  },
  "timestamp": "2026-05-10T00:00:00.000Z",
  "path": "/auth/verify-email"
}
```

Postman test should save:

```js
const json = pm.response.json();
pm.collectionVariables.set("accessToken", json.data.token.accessToken);
```

Backend behavior:

```txt
Validates OTP
Creates real user
Creates user profile
Deletes pending registration
Returns access token
```

---

## 3.3 Resend OTP

```http
POST {{baseUrl}}/auth/resend-otp
```

Body:

```json
{
  "email": "{{email}}"
}
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "OTP sent successfully",
  "data": null
}
```

---

## 3.4 Login

```http
POST {{baseUrl}}/auth/login
```

Body:

```json
{
  "email": "{{email}}",
  "password": "{{password}}"
}
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Signed in successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "fullName": "John Doe",
      "role": "USER"
    },
    "token": {
      "accessToken": "jwt-token",
      "tokenType": "Bearer",
      "expiresIn": "7d"
    }
  }
}
```

Postman test should save access token:

```js
const json = pm.response.json();
pm.collectionVariables.set("accessToken", json.data.token.accessToken);
```

---

## 3.5 Forgot Password

```http
POST {{baseUrl}}/auth/forgot-password
```

Body:

```json
{
  "email": "{{email}}"
}
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "If this email exists, a reset code has been sent.",
  "data": null
}
```

---

## 3.6 Reset Password

```http
POST {{baseUrl}}/auth/reset-password
```

Body:

```json
{
  "email": "{{email}}",
  "otp": "{{otp}}",
  "newPassword": "{{password}}"
}
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password changed successfully",
  "data": null
}
```

---

# 4. User APIs

All `/users` APIs require:

```http
Authorization: Bearer {{accessToken}}
```

## 4.1 Get Me

```http
GET {{baseUrl}}/users/me
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Profile fetched successfully",
  "data": {
    "id": "uuid",
    "email": "john@example.com",
    "role": "USER",
    "status": "ACTIVE",
    "emailVerifiedAt": "2026-05-10T00:00:00.000Z",
    "profile": {
      "fullName": "John Doe",
      "profilePhotoFileId": "uuid-or-null",
      "photoReadUrl": "temporary-signed-read-url-or-null"
    }
  }
}
```

`photoReadUrl` is temporary because S3 bucket is private.

---

## 4.2 Update Profile

```http
PATCH {{baseUrl}}/users/me/profile
```

Body:

```json
{
  "fullName": "{{fullName}}"
}
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Profile updated successfully",
  "data": {
    "fullName": "John Doe"
  }
}
```

Validation:

```txt
Only letters, spaces, hyphen, and apostrophe are allowed.
No numeric name.
```

---

## 4.3 Update Profile Photo

```http
PATCH {{baseUrl}}/users/me/profile-photo
```

Body:

```json
{
  "fileId": "{{fileId}}"
}
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Profile photo updated successfully",
  "data": {
    "profilePhotoFileId": "uuid",
    "photoReadUrl": "temporary-signed-read-url"
  }
}
```

Important:

```txt
The file must be confirmed first.
File status must be UPLOADED.
```

---

## 4.4 Delete Account

```http
POST {{baseUrl}}/users/me/delete-account
```

Body:

```json
{
  "fullName": "{{fullName}}"
}
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Account deleted successfully",
  "data": null
}
```

---

# 5. S3 Upload APIs

All backend `/files` APIs require:

```http
Authorization: Bearer {{accessToken}}
```

The direct S3 upload/read requests do not use Bearer token because signed URLs already include temporary access.

---

## 5.1 Get Signed Upload URL

```http
POST {{baseUrl}}/files/signed-upload-url
```

Body:

```json
{
  "fileName": "{{uploadFileName}}",
  "contentType": "{{uploadContentType}}",
  "sizeBytes": "{{uploadSizeBytes}}",
  "folder": "{{uploadFolder}}"
}
```

Example:

```json
{
  "fileName": "profile.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 250000,
  "folder": "profile-photos"
}
```

Expected response:

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Signed upload URL created successfully",
  "data": {
    "fileId": "uuid",
    "fileKey": "profile-photos/user-id/uuid-profile.jpg",
    "uploadUrl": "https://private-bucket.s3.region.amazonaws.com/...",
    "expiresInSeconds": 300,
    "method": "PUT",
    "headers": {
      "Content-Type": "image/jpeg"
    }
  }
}
```

Postman test:

```js
const json = pm.response.json();

pm.collectionVariables.set("fileId", json.data.fileId);
pm.collectionVariables.set("fileKey", json.data.fileKey);
pm.collectionVariables.set("uploadUrl", json.data.uploadUrl);
pm.collectionVariables.set("uploadContentType", json.data.headers["Content-Type"]);
```

---

## 5.2 Upload File Directly to S3

```http
PUT {{uploadUrl}}
```

Headers:

```http
Content-Type: {{uploadContentType}}
```

Body:

```txt
binary/file
```

In Postman:

```txt
Body → binary → Select File
```

Important:

```txt
Do not use Authorization Bearer token here.
This request goes directly to S3.
The selected file must match contentType and sizeBytes from step 5.1.
The upload URL expires after configured time.
```

Expected S3 response:

```txt
200 OK
```

Usually the response body is empty.

---

## 5.3 Confirm Upload

```http
POST {{baseUrl}}/files/confirm-upload
```

Body:

```json
{
  "fileId": "{{fileId}}"
}
```

Expected response:

```json
{
  "success": true,
  "statusCode": 201,
  "message": "File upload confirmed successfully",
  "data": {
    "id": "uuid",
    "fileKey": "profile-photos/user-id/uuid-profile.jpg",
    "originalFileName": "profile.jpg",
    "mimeType": "image/jpeg",
    "sizeBytes": 250000,
    "folder": "profile-photos",
    "status": "UPLOADED",
    "uploadedAt": "2026-05-10T00:00:00.000Z"
  }
}
```

Backend checks:

```txt
File exists in S3
File content type matches
File size matches
Upload URL has not expired
```

---

## 5.4 Get Signed Read URL

```http
GET {{baseUrl}}/files/{{fileId}}/signed-read-url
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Signed read URL created successfully",
  "data": {
    "fileId": "uuid",
    "fileKey": "profile-photos/user-id/uuid-profile.jpg",
    "readUrl": "https://private-bucket.s3.region.amazonaws.com/...",
    "expiresInSeconds": 900
  }
}
```

Postman test:

```js
const json = pm.response.json();
pm.collectionVariables.set("readUrl", json.data.readUrl);
```

---

## 5.5 Open Signed Read URL

```http
GET {{readUrl}}
```

Important:

```txt
No Bearer token needed.
This request goes directly to S3.
The signed read URL expires after configured time.
```

Expected result:

```txt
200 OK
Image/file binary response
```

---

## 5.6 Delete File

```http
DELETE {{baseUrl}}/files/{{fileId}}
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "File deleted successfully",
  "data": null
}
```

---

# 6. Frontend Upload Instructions

## 6.1 Get signed upload URL

```ts
const signedUrlResponse = await api.post('/files/signed-upload-url', {
  fileName: file.name,
  contentType: file.type,
  sizeBytes: file.size,
  folder: 'profile-photos',
});

const { fileId, uploadUrl, headers } = signedUrlResponse.data.data;
```

---

## 6.2 Upload directly to S3

```ts
const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': headers['Content-Type'],
  },
  body: file,
});

if (!uploadResponse.ok) {
  throw new Error('Failed to upload file to S3');
}
```

Do not send app access token to S3.

---

## 6.3 Confirm upload

```ts
await api.post('/files/confirm-upload', {
  fileId,
});
```

---

## 6.4 Set as profile photo

```ts
const profilePhotoResponse = await api.patch('/users/me/profile-photo', {
  fileId,
});

const photoReadUrl = profilePhotoResponse.data.data.photoReadUrl;
```

---

## 6.5 Fetch current profile

```ts
const profileResponse = await api.get('/users/me');

const user = profileResponse.data.data;
const photoReadUrl = user.profile.photoReadUrl;
```

Use it:

```tsx
<img src={photoReadUrl} alt="Profile" />
```

Because `photoReadUrl` is temporary, refresh it from:

```http
GET /users/me
```

or:

```http
GET /files/:fileId/signed-read-url
```

when it expires.

---

# 7. Full Frontend Helper Function

```ts
type UploadFolder = 'profile-photos' | 'documents' | 'general';

interface UploadPrivateFileResult {
  fileId: string;
  fileKey: string;
  readUrl: string;
}

export async function uploadPrivateFile(
  file: File,
  folder: UploadFolder,
): Promise<UploadPrivateFileResult> {
  const signedUploadResponse = await api.post('/files/signed-upload-url', {
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    folder,
  });

  const { fileId, fileKey, uploadUrl, headers } =
    signedUploadResponse.data.data;

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': headers['Content-Type'],
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file to storage');
  }

  await api.post('/files/confirm-upload', {
    fileId,
  });

  const signedReadResponse = await api.get(
    `/files/${fileId}/signed-read-url`,
  );

  return {
    fileId,
    fileKey,
    readUrl: signedReadResponse.data.data.readUrl,
  };
}
```

---

# 8. Recommended Postman Testing Order

Use this order:

```txt
01 Auth / Register
01 Auth / Verify Email
01 Auth / Login
03 S3 Upload / 1. Get Signed Upload URL
03 S3 Upload / 2. Upload File Directly To S3
03 S3 Upload / 3. Confirm Upload
02 Users / Update Profile Photo
02 Users / Get Me
03 S3 Upload / 4. Get Signed Read URL
03 S3 Upload / 5. Open Signed Read URL
```

Avoid running `Delete Account` or `Delete File` until the end.
