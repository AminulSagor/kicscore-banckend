Frontend integration guide — Account deletion

Purpose
- Describe the in-app "Delete account" flow and how to call the backend endpoint so the app satisfies platform (Google Play) requirements for user data deletion.

Endpoint
- URL: POST /users/me/delete-account
- Auth: Bearer token (user must be authenticated)
- Content-Type: application/json

Request body (DeleteAccountDto)
- fullName: string (required) — exact full name confirmation shown to user

Example request (fetch)
```javascript
fetch('/users/me/delete-account', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ fullName: userFullNameFromProfile }),
})
  .then(async (res) => {
    if (!res.ok) throw await res.json();
    return res.json();
  })
  .then(() => {
    // deletion successful — clear local data, sign out, show goodbye screen
  })
  .catch((err) => {
    // handle validation errors (400), not found (404), and server errors
  });
```

Expected responses
- 200 OK
  - JSON: { message: 'Account deleted successfully', data: null }
- 400 Bad Request
  - if full name confirmation doesn't match
- 404 Not Found
  - if the authenticated user record cannot be found
- 5xx
  - server-side errors; show a friendly error and contact support

Recommended UI flow (required by app stores)
1. Settings -> Account -> Delete account button.
2. Show a clear confirmation modal explaining irreversible deletion and what data will be erased (profile, files, notifications, device tokens, OTPs, settings, etc.).
3. To prevent accidental deletions and to verify intent, require the user to type their full name exactly as shown in their profile into a text input. Optionally require password re-entry (recommended).
4. Show the API call progress (spinner) and disable UI while the request is running.
5. On success:
   - Clear tokens/local storage/cache
   - Sign the user out locally
   - Redirect to a goodbye or onboarding screen
   - Optionally provide a short survey or link to support
6. On failure:
   - Show concise error messages (e.g., "Name confirmation does not match") and a support contact link

Security & privacy recommendations
- Re-authenticate or ask for password when deleting highly-sensitive accounts.
- Ensure the app does not retain user personal data after deletion (clear caches, analytics identifiers where appropriate).
- If you offer account export, provide that option before deletion.
- Ensure the privacy policy link and support contact are visible in the delete flow.

Edge cases & integration notes
- The backend implementation deletes S3 objects and DB rows; however, third-party backups/analytics might retain data — implement removal where possible.
- If you need a visible audit trail for compliance, store only minimal non-personal audit metadata (timestamp, hashed user id) in a separate system that cannot be used to reconstruct personal data.

Testing
- Test the flow with a real user account in a staging environment:
  - create user with files and device tokens
  - call delete endpoint
  - verify S3 objects removed and DB rows deleted or nullified
  - verify app signs out and cannot fetch protected endpoints

Developer notes
- Current backend requires `fullName` to match profile full name. If you want stronger verification, request and submit current password as well.
- Backend endpoint: [POST /users/me/delete-account]

Questions or changes
- Tell me if you want the frontend to require password re-entry; I can update the backend to accept and validate a password before deletion.

Postman testing

- Set request: `POST {{BASE_URL}}/users/me/delete-account`
- Headers:
  - `Authorization`: `Bearer <ACCESS_TOKEN>`
  - `Content-Type`: `application/json`
- Body (raw JSON):
```json
{
  "fullName": "Exact Full Name From Profile"
}
```
- Obtain a valid `ACCESS_TOKEN` by calling your login endpoint (`POST /auth/login` or equivalent) with test credentials and copying the returned JWT.
- Expected flow:
  - Send the request; expect `200 OK` with `{"message":"Account deleted successfully","data":null}`.
  - After success, calling `GET /users/me` should return `404` or `401` (depending on client session state).
  - Confirm side-effects in staging:
    - Files owned by the user are removed from S3 (or their DB records deleted).
    - `device_tokens`, `otp_codes`, and `user_settings` rows for that user are deleted.

Notes
- Use a staging account and not production data when testing deletions.
- If you want, I can export a Postman collection with the login + delete requests; tell me and I'll add it to the repo.
