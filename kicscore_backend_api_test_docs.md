# Kicscore Backend API Test Docs

This document matches the current backend controllers:

- `AuthController` under `/auth`
- `UsersController` under `/users`
- `FilesController` under `/files`
- `HealthController` under `/health`
- `FootballController` under `/football`
- `DeviceTokensController` under `/device-tokens`
- `FollowsController` under `/follows`

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

fixtureId=123456
fixtureDate=2026-05-10
timezone=Asia/Dhaka
teamId=33
leagueId=39
season=2025
playerId=874
coachId=100
venueId=556
searchQuery=arsenal
h2h=33-34
round=Regular Season - 1

# Device token + follow variables
fcmToken=test-fcm-token-android-001
iosFcmToken=test-fcm-token-ios-001
webFcmToken=test-fcm-token-web-001
devicePlatform=ANDROID
installationId=postman-installation-001
appVersion=1.0.0
deviceModel=Postman Device
osVersion=Android 14
locale=en
deviceTimezone=Asia/Dhaka
followEntityType=TEAM
followEntityId={{teamId}}
followEntityName=Manchester United
followEntityLogo=https://media.api-sports.io/football/teams/33.png
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
---

# 8. Redis Health API

This API is public and is mainly for checking whether the backend can connect to Redis.

## 8.1 Check Redis Health

```http
GET {{baseUrl}}/health/redis
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Redis is working",
  "data": {
    "status": "ok",
    "checkedAt": "2026-05-10T00:00:00.000Z"
  },
  "timestamp": "2026-05-10T00:00:00.000Z",
  "path": "/health/redis"
}
```

Important:

```txt
If this API returns 401 Unauthorized, the route is still protected by auth guard.
Make the route public using the Public decorator.
```

---

# 9. Football APIs - API-Football Cached Gateway

All football APIs should be called from the frontend through your backend.
The frontend should not call API-Football directly.

```txt
Frontend
  ↓
Backend /football routes
  ↓
Redis cache + Redis lock
  ↓
API-Football only on cache miss
```

These routes are public in the current controller because football data is app content. User-specific actions such as follow/unfollow, notification settings, and notification inbox should be separate authenticated APIs.

## 9.1 Football Postman Variables

Add these variables to the Postman collection/environment:

```txt
fixtureId=123456
fixtureDate=2026-05-10
timezone=Asia/Dhaka
teamId=33
leagueId=39
season=2025
playerId=874
coachId=100
venueId=556
searchQuery=arsenal
h2h=33-34
round=Regular Season - 1

# Device token + follow variables
fcmToken=test-fcm-token-android-001
iosFcmToken=test-fcm-token-ios-001
webFcmToken=test-fcm-token-web-001
devicePlatform=ANDROID
installationId=postman-installation-001
appVersion=1.0.0
deviceModel=Postman Device
osVersion=Android 14
locale=en
deviceTimezone=Asia/Dhaka
followEntityType=TEAM
followEntityId={{teamId}}
followEntityName=Manchester United
followEntityLogo=https://media.api-sports.io/football/teams/33.png
```

---

## 9.2 Live Fixtures

```http
GET {{baseUrl}}/football/fixtures/live
```

Backend calls:

```txt
/fixtures?live=all
```

Recommended cache:

```txt
Fresh TTL: 15-30 seconds
Stale TTL: 90-120 seconds
```

Use for:

```txt
Ongoing tab
Live match cards
Notification workers for live match status
```

---

## 9.3 Fixtures by Date

```http
GET {{baseUrl}}/football/fixtures?date={{fixtureDate}}&timezone={{timezone}}
```

Backend calls:

```txt
/fixtures?date=YYYY-MM-DD&timezone=Asia/Dhaka
```

Recommended cache:

```txt
Today: 5-15 minutes
Future: 6-24 hours
Past: 24 hours to 7 days
```

Use for:

```txt
Home match list
By time tab
League grouped match cards
Upcoming match reminders
```

---

## 9.4 Fixture by ID

```http
GET {{baseUrl}}/football/fixtures/{{fixtureId}}
```

Backend calls:

```txt
/fixtures?ids=FIXTURE_ID
```

Recommended cache:

```txt
Live match: 15-30 seconds
Finished match: 1-7 days
```

Use for:

```txt
Match header
Scoreboard
Match status
Kickoff time
Venue/referee basic info
Full-time status detection
```

---

## 9.5 Fixture Events

```http
GET {{baseUrl}}/football/fixtures/{{fixtureId}}/events
```

Backend calls:

```txt
/fixtures/events?fixture=FIXTURE_ID
```

Recommended cache:

```txt
Live: 15-30 seconds
Finished: 1-7 days
```

Use for:

```txt
Goals
Cards
Substitutions
Timeline
Goal notification
Red card notification
Player event notification
```

---

## 9.6 Fixture Statistics

```http
GET {{baseUrl}}/football/fixtures/{{fixtureId}}/statistics
```

Backend calls:

```txt
/fixtures/statistics?fixture=FIXTURE_ID
```

Recommended cache:

```txt
Live: 60 seconds
Finished: 1-7 days
```

Use for:

```txt
Possession
Shots
Corners
Cards
Passes
Saves
Stats tab
```

---

## 9.7 Fixture Lineups

```http
GET {{baseUrl}}/football/fixtures/{{fixtureId}}/lineups
```

Backend calls:

```txt
/fixtures/lineups?fixture=FIXTURE_ID
```

Recommended cache:

```txt
Before lineup found: 5-10 minutes
After lineup found: 12-24 hours
```

Use for:

```txt
Lineup tab
Starting XI notification
Formation
Coach
Bench/substitutes
```

---

## 9.8 Fixture Players

```http
GET {{baseUrl}}/football/fixtures/{{fixtureId}}/players
```

Backend calls:

```txt
/fixtures/players?fixture=FIXTURE_ID
```

Recommended cache:

```txt
Live: 2-5 minutes if needed
Finished: 1-7 days
```

Use for:

```txt
Player ratings
Player of the match
Post-match player stats
```

---

## 9.9 Fixture Head-to-Head

```http
GET {{baseUrl}}/football/fixtures/head-to-head?h2h={{h2h}}&last=5
```

Backend calls:

```txt
/fixtures/headtohead?h2h=TEAM_A-TEAM_B&last=5
```

Recommended cache:

```txt
24 hours to 7 days
```

Use for:

```txt
Head-to-head tab
Previous meetings
Preview comparisons
```

---

## 9.10 Fixture Rounds

```http
GET {{baseUrl}}/football/fixtures/rounds?league={{leagueId}}&season={{season}}
```

Backend calls:

```txt
/fixtures/rounds?league=LEAGUE_ID&season=SEASON
```

Recommended cache:

```txt
1-7 days
```

Use for:

```txt
League fixtures by round
World Cup rounds
Knockout bracket building
```

---

## 9.11 Team Fixtures

```http
GET {{baseUrl}}/football/teams/{{teamId}}/fixtures?next=5
```

Alternative:

```http
GET {{baseUrl}}/football/teams/{{teamId}}/fixtures?last=6
```

Backend calls:

```txt
/fixtures?team=TEAM_ID&next=5
/fixtures?team=TEAM_ID&last=6
```

Recommended cache:

```txt
Next fixtures: 1-6 hours
Last fixtures: 1-12 hours
```

Use for:

```txt
Team overview next match
Team last matches
Upcoming match notification
```

---

## 9.12 Teams

```http
GET {{baseUrl}}/football/teams?id={{teamId}}
```

Search:

```http
GET {{baseUrl}}/football/teams?search={{searchQuery}}
```

By league:

```http
GET {{baseUrl}}/football/teams?league={{leagueId}}&season={{season}}
```

Backend calls:

```txt
/teams?id=TEAM_ID
/teams?search=QUERY
/teams?league=LEAGUE_ID&season=SEASON
```

Recommended cache:

```txt
Team profile: 7-30 days
Search: 1-7 days
Teams by league: 1-7 days
```

Use for:

```txt
Team detail header
Team search
World Cup team list
League team dropdown
```

---

## 9.13 Leagues

```http
GET {{baseUrl}}/football/leagues?id={{leagueId}}
```

Search:

```http
GET {{baseUrl}}/football/leagues?search=premier
```

Current leagues:

```http
GET {{baseUrl}}/football/leagues?current=true
```

Backend calls:

```txt
/leagues?id=LEAGUE_ID
/leagues?search=QUERY
/leagues?current=true
```

Recommended cache:

```txt
League profile: 7-30 days
Search: 1-7 days
```

Use for:

```txt
League detail header
League search
Top leagues list
League season selector data
```

---

## 9.14 Countries

```http
GET {{baseUrl}}/football/countries
```

Backend calls:

```txt
/countries
```

Recommended cache:

```txt
7-30 days
```

Use for:

```txt
All leagues by country
Country filters
```

---

## 9.15 Standings

```http
GET {{baseUrl}}/football/standings?league={{leagueId}}&season={{season}}
```

Backend calls:

```txt
/standings?league=LEAGUE_ID&season=SEASON
```

Recommended cache:

```txt
30 minutes to 6 hours
After live match final: refresh sooner if needed
```

Use for:

```txt
League table
Mini table
Team table tab
World Cup group standings
Table change notification
```

---

## 9.16 Player Squads

```http
GET {{baseUrl}}/football/players/squads?team={{teamId}}
```

Backend calls:

```txt
/players/squads?team=TEAM_ID
```

Recommended cache:

```txt
1-7 days
```

Use for:

```txt
Team squad tab
Players grouped by position
Lineup prediction support later
```

---

## 9.17 Top Scorers

```http
GET {{baseUrl}}/football/players/top-scorers?league={{leagueId}}&season={{season}}
```

Backend calls:

```txt
/players/topscorers?league=LEAGUE_ID&season=SEASON
```

Recommended cache:

```txt
1-6 hours
```

Use for:

```txt
League top scorers card
Top scorer list
Top scorer update notification later
```

---

## 9.18 Top Assists

```http
GET {{baseUrl}}/football/players/top-assists?league={{leagueId}}&season={{season}}
```

Backend calls:

```txt
/players/topassists?league=LEAGUE_ID&season=SEASON
```

Recommended cache:

```txt
1-6 hours
```

Use for:

```txt
League top assists card
Top assists list
```

---

## 9.19 Players

```http
GET {{baseUrl}}/football/players?id={{playerId}}&season={{season}}
```

Search:

```http
GET {{baseUrl}}/football/players?search=messi&season={{season}}
```

Team season stats:

```http
GET {{baseUrl}}/football/players?team={{teamId}}&season={{season}}
```

Backend calls:

```txt
/players?id=PLAYER_ID&season=SEASON
/players?search=QUERY&season=SEASON
/players?team=TEAM_ID&season=SEASON
```

Recommended cache:

```txt
Player profile/stats: 6-24 hours
Search: 1-7 days
```

Use for:

```txt
Player profile
Player stats tab
Team top players
Player search
```

---

## 9.20 Transfers

```http
GET {{baseUrl}}/football/transfers?team={{teamId}}
```

Player transfer history:

```http
GET {{baseUrl}}/football/transfers?player={{playerId}}
```

Backend calls:

```txt
/transfers?team=TEAM_ID
/transfers?player=PLAYER_ID
```

Recommended cache:

```txt
6-24 hours
```

Use for:

```txt
Team transfer updates
Player transfer timeline
Transfer notification worker
```

---

## 9.21 Injuries

```http
GET {{baseUrl}}/football/injuries?team={{teamId}}&season={{season}}
```

Fixture injuries:

```http
GET {{baseUrl}}/football/injuries?fixture={{fixtureId}}
```

Backend calls:

```txt
/injuries?team=TEAM_ID&season=SEASON
/injuries?fixture=FIXTURE_ID
```

Recommended cache:

```txt
6-24 hours
```

Use for:

```txt
Injury cards
Unavailable player notification later
```

---

## 9.22 Coaches

```http
GET {{baseUrl}}/football/coaches?id={{coachId}}
```

Current team coach:

```http
GET {{baseUrl}}/football/coaches?team={{teamId}}
```

Backend calls:

```txt
/coachs?id=COACH_ID
/coachs?team=TEAM_ID
```

Recommended cache:

```txt
7-30 days
```

Use for:

```txt
Coach profile
Team squad coach card
Coach career timeline
```

---

## 9.23 Trophies

```http
GET {{baseUrl}}/football/trophies?player={{playerId}}
```

Coach trophies:

```http
GET {{baseUrl}}/football/trophies?coach={{coachId}}
```

Backend calls:

```txt
/trophies?player=PLAYER_ID
/trophies?coach=COACH_ID
```

Recommended cache:

```txt
7-30 days
```

Use for:

```txt
Player trophy section
Coach trophy section
```

---

## 9.24 Venues

```http
GET {{baseUrl}}/football/venues?id={{venueId}}
```

Backend calls:

```txt
/venues?id=VENUE_ID
```

Recommended cache:

```txt
7-30 days
```

Use for:

```txt
Stadium card
Venue meta card
```

---

## 9.25 Predictions

```http
GET {{baseUrl}}/football/predictions?fixture={{fixtureId}}
```

Backend calls:

```txt
/predictions?fixture=FIXTURE_ID
```

Recommended cache:

```txt
Upcoming match: 1-6 hours
Finished match: 1-7 days
```

Use for:

```txt
Preview prediction/advice widget
```

---

## 9.26 Composite Search

```http
GET {{baseUrl}}/football/search?q={{searchQuery}}&season={{season}}
```

Backend calls in parallel:

```txt
/teams?search=QUERY
/leagues?search=QUERY
/players?search=QUERY&season=SEASON
```

Recommended cache:

```txt
1-7 days
```

Validation:

```txt
Search query should be at least 3 characters.
Frontend should debounce search input.
```

Use for:

```txt
Global search
All search tab
Team/league/player autocomplete
```

---

# 10. Football Frontend Usage Pattern

The frontend should use backend routes only:

```ts
const liveFixturesResponse = await api.get('/football/fixtures/live');
const fixturesResponse = await api.get('/football/fixtures', {
  params: {
    date: '2026-05-10',
    timezone: 'Asia/Dhaka',
  },
});
```

Do not expose the API-Football key in frontend.

```txt
Wrong:
Frontend → API-Football

Correct:
Frontend → Backend → Redis → API-Football
```

---

# 11. Cache and Notification Reuse Rule

Do not integrate the same API-Football endpoint twice.

Use one shared service:

```txt
FootballService
  ↓
ApiFootballCacheService
  ↓
Redis
  ↓
API-Football
```

Frontend routes and notification workers should both reuse this same service:

```txt
Frontend route → FootballService → Redis → API-Football
Worker        → FootballService → Redis → API-Football
```

Examples:

```txt
Goal notification worker should reuse:
- getLiveFixtures()
- getFixtureEvents(fixtureId)

Starting XI worker should reuse:
- getFixtureLineups(fixtureId)

Transfer worker should reuse:
- getTransfers({ team })
- getTransfers({ player })
```

---


---

# 10. Device Token APIs - Anonymous and Registered Users

Device token APIs connect an app installation to an FCM token. These APIs support both anonymous/unregistered users and registered users.

Simple rule:

```txt
Anonymous/unregistered user → installationId + FCM token
Registered user             → userId + installationId + FCM token
Push delivery               → FCM token
```

Important:

```txt
FCM token is not the user identity.
Use userId for registered users.
Use installationId for anonymous/unregistered users.
Use FCM token only as the push delivery address.
```

---

## 10.1 Register Device Token - Anonymous / Unregistered

```http
POST {{baseUrl}}/device-tokens/register
```

Authorization:

```txt
No Bearer token
```

Body:

```json
{
  "token": "{{fcmToken}}",
  "platform": "{{devicePlatform}}",
  "installationId": "{{installationId}}",
  "appVersion": "{{appVersion}}",
  "deviceModel": "{{deviceModel}}",
  "osVersion": "{{osVersion}}",
  "locale": "{{locale}}",
  "timezone": "{{deviceTimezone}}"
}
```

Expected behavior:

```txt
Creates or updates device token
userId = null
installationId = provided installationId
isActive = true
lastSeenAt = current time
```

Expected response:

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Device token registered successfully",
  "data": {
    "id": "uuid",
    "token": "test-fcm-token-android-001",
    "platform": "ANDROID",
    "installationId": "postman-installation-001",
    "userId": null,
    "isActive": true
  }
}
```

Use for:

```txt
First app open
Guest/anonymous users
Users who have not logged in yet
FCM token refresh before login
```

---

## 10.2 Register Device Token - Registered User

```http
POST {{baseUrl}}/device-tokens/register
```

Authorization:

```http
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "token": "{{fcmToken}}",
  "platform": "{{devicePlatform}}",
  "installationId": "{{installationId}}",
  "appVersion": "{{appVersion}}",
  "deviceModel": "{{deviceModel}}",
  "osVersion": "{{osVersion}}",
  "locale": "{{locale}}",
  "timezone": "{{deviceTimezone}}"
}
```

Expected behavior:

```txt
Creates or updates device token
userId = logged-in user ID from JWT
installationId = provided installationId
isActive = true
lastSeenAt = current time
```

Use for:

```txt
After login
After registration verification
FCM token refresh after login
Opening app while already logged in
```

---

## 10.3 Get My Device Tokens - Registered User Only

```http
GET {{baseUrl}}/device-tokens/me
```

Authorization:

```http
Authorization: Bearer {{accessToken}}
```

Expected behavior:

```txt
Returns active device tokens for the logged-in user.
Anonymous users cannot use this route because they do not have a JWT userId.
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Device tokens fetched successfully",
  "data": [
    {
      "id": "uuid",
      "platform": "ANDROID",
      "installationId": "postman-installation-001",
      "userId": "logged-in-user-id",
      "isActive": true
    }
  ]
}
```

---

## 10.4 Deactivate Device Token - Anonymous / Unregistered

```http
POST {{baseUrl}}/device-tokens/deactivate
```

Authorization:

```txt
No Bearer token
```

Body:

```json
{
  "token": "{{fcmToken}}",
  "installationId": "{{installationId}}"
}
```

Expected behavior:

```txt
Finds token
Verifies installationId if provided
Marks isActive = false
Does not delete the row permanently
```

Use for:

```txt
Anonymous logout/reset flow
App token cleanup
User disables notifications before login
```

---

## 10.5 Deactivate Device Token - Registered User

```http
POST {{baseUrl}}/device-tokens/deactivate
```

Authorization:

```http
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "token": "{{fcmToken}}",
  "installationId": "{{installationId}}"
}
```

Expected behavior:

```txt
Finds token
Checks token belongs to logged-in user when userId exists
Marks isActive = false
```

Use for:

```txt
Logout
Token refresh cleanup
User disables push notifications
Removing invalid FCM token after FCM delivery failure
```

---

# 11. Follow APIs - Anonymous and Registered Users

Follow APIs store which football entities a user wants to follow.

Supported entity types:

```txt
TEAM
PLAYER
LEAGUE
FIXTURE
COACH
```

Simple rule:

```txt
Anonymous/unregistered follow → installationId
Registered follow             → userId from JWT
```

Follow data should be stored in PostgreSQL because it is user-specific and permanent. Redis is not the source of truth for follows.

---

## 11.1 Follow Entity - Anonymous / Unregistered

```http
POST {{baseUrl}}/follows
```

Authorization:

```txt
No Bearer token
```

Body:

```json
{
  "entityType": "{{followEntityType}}",
  "entityId": "{{followEntityId}}",
  "installationId": "{{installationId}}",
  "entityName": "{{followEntityName}}",
  "entityLogo": "{{followEntityLogo}}",
  "notificationEnabled": true,
  "metadata": {
    "source": "postman-test"
  }
}
```

Expected behavior:

```txt
Creates or reactivates follow row
userId = null
installationId = provided installationId
isActive = true
notificationEnabled = true
```

Use for:

```txt
Guest user follows a team/player/league/match
Guest user wants notifications without account registration
```

---

## 11.2 Follow Entity - Registered User

```http
POST {{baseUrl}}/follows
```

Authorization:

```http
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "entityType": "{{followEntityType}}",
  "entityId": "{{followEntityId}}",
  "installationId": "{{installationId}}",
  "entityName": "{{followEntityName}}",
  "entityLogo": "{{followEntityLogo}}",
  "notificationEnabled": true,
  "metadata": {
    "source": "postman-test"
  }
}
```

Expected behavior:

```txt
Creates or reactivates follow row
userId = logged-in user ID from JWT
installationId is ignored for ownership, but can be sent for context
isActive = true
notificationEnabled = true
```

---

## 11.3 Get Follows - Anonymous / Unregistered

```http
GET {{baseUrl}}/follows?installationId={{installationId}}
```

Authorization:

```txt
No Bearer token
```

Optional query:

```http
GET {{baseUrl}}/follows?installationId={{installationId}}&entityType=TEAM
```

Expected behavior:

```txt
Returns active follows for this installationId.
```

---

## 11.4 Get Follows - Registered User

```http
GET {{baseUrl}}/follows
```

Authorization:

```http
Authorization: Bearer {{accessToken}}
```

Optional query:

```http
GET {{baseUrl}}/follows?entityType=TEAM
```

Expected behavior:

```txt
Returns active follows for logged-in user.
```

---

## 11.5 Get Follow Status - Anonymous / Unregistered

```http
GET {{baseUrl}}/follows/status?entityType={{followEntityType}}&entityId={{followEntityId}}&installationId={{installationId}}
```

Authorization:

```txt
No Bearer token
```

Expected response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Follow status fetched successfully",
  "data": {
    "followed": true,
    "follow": {
      "id": "uuid",
      "entityType": "TEAM",
      "entityId": "33"
    }
  }
}
```

---

## 11.6 Get Follow Status - Registered User

```http
GET {{baseUrl}}/follows/status?entityType={{followEntityType}}&entityId={{followEntityId}}
```

Authorization:

```http
Authorization: Bearer {{accessToken}}
```

Expected behavior:

```txt
Checks whether logged-in user follows the requested entity.
```

---

## 11.7 Unfollow Entity - Anonymous / Unregistered

```http
DELETE {{baseUrl}}/follows/{{followEntityType}}/{{followEntityId}}?installationId={{installationId}}
```

Authorization:

```txt
No Bearer token
```

Expected behavior:

```txt
Finds anonymous follow by installationId + entityType + entityId
Marks isActive = false
Marks notificationEnabled = false
```

---

## 11.8 Unfollow Entity - Registered User

```http
DELETE {{baseUrl}}/follows/{{followEntityType}}/{{followEntityId}}
```

Authorization:

```http
Authorization: Bearer {{accessToken}}
```

Expected behavior:

```txt
Finds registered follow by userId + entityType + entityId
Marks isActive = false
Marks notificationEnabled = false
```

---

## 11.9 Merge Anonymous Follows After Login

```http
POST {{baseUrl}}/follows/merge-anonymous
```

Authorization:

```http
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "installationId": "{{installationId}}"
}
```

Expected behavior:

```txt
Finds active anonymous follows by installationId
Moves them under logged-in userId
If user already follows same entity, it keeps the user follow and deactivates duplicate anonymous follow
Returns mergedCount
```

Use this right after:

```txt
Login
Register + verify email
```

---

# 12. Anonymous to Registered Full Test Flow

Use this flow in Postman to verify both user types:

```txt
1. 05 Device Tokens / Anonymous / Register Device Token - Anonymous
2. 06 Follows / Anonymous / Follow Entity - Anonymous
3. 06 Follows / Anonymous / Get Follows - Anonymous
4. 06 Follows / Anonymous / Get Follow Status - Anonymous
5. 01 Auth / Register
6. 01 Auth / Verify Email OR 01 Auth / Login
7. 05 Device Tokens / Registered / Register Device Token - Registered
8. 06 Follows / Registered / Merge Anonymous Follows After Login
9. 06 Follows / Registered / Get Follows - Registered
10. 05 Device Tokens / Registered / Get My Device Tokens
```

Expected result:

```txt
Before login: follow belongs to installationId
After merge: follow belongs to userId
Device token becomes linked to userId after registered device-token register call
```

---

# 13. Notification Worker Usage Later

When a goal/team/player/league event happens later, the worker should use follows like this:

```txt
1. Detect event from cached FootballService
2. Example: TEAM 33 goal event
3. Query follows where entityType=TEAM and entityId=33 and notificationEnabled=true
4. For follows with userId: load active device tokens by userId
5. For follows with installationId: load active device tokens by installationId
6. Send push through FcmService
7. Save notification event/inbox later
```

This means both anonymous and registered users can receive notifications.


# 14. Updated Recommended Postman Testing Order

Use this order:

```txt
01 Auth / Register
01 Auth / Verify Email
01 Auth / Login
Check Redis Health / Health Checker
04 Football - API-Football Cached Gateway / Live Fixtures
04 Football - API-Football Cached Gateway / Fixtures By Date
04 Football - API-Football Cached Gateway / Teams - By ID
04 Football - API-Football Cached Gateway / Leagues - By ID
04 Football - API-Football Cached Gateway / Standings
05 Device Tokens / Anonymous / Register Device Token - Anonymous
06 Follows / Anonymous / Follow Entity - Anonymous
06 Follows / Anonymous / Get Follows - Anonymous
05 Device Tokens / Registered / Register Device Token - Registered
06 Follows / Registered / Merge Anonymous Follows After Login
06 Follows / Registered / Get Follows - Registered
05 Device Tokens / Registered / Get My Device Tokens
03 S3 Upload / 1. Get Signed Upload URL
03 S3 Upload / 2. Upload File Directly To S3
03 S3 Upload / 3. Confirm Upload
02 Users / Update Profile Photo
02 Users / Get Me
03 S3 Upload / 4. Get Signed Read URL
03 S3 Upload / 5. Open Signed Read URL
```

Avoid running `Delete Account` or `Delete File` until the end.

---

# 15. Current Remaining Backend Work

These are not part of the current football cached gateway yet:

```txt
News API integration
News entity mapping to team/player/league
Notification preferences
Notification inbox
Notification workers
Delivery tracking and invalid FCM token cleanup
Admin/test send notification API
```

Priority for notification dependency:

```txt
1. /football/fixtures/live
2. /football/fixtures/:fixtureId
3. /football/fixtures/:fixtureId/events
4. /football/fixtures/:fixtureId/lineups
5. /football/transfers
6. /football/injuries
7. News API cached service
```
