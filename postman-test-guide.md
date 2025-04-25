# Testing API with Postman

This guide shows how to test the API controllers using Postman with WebSocket requests.

## Step 1: Install Postman WebSocket Plugin

1. Open Postman and navigate to the Plugins section
2. Search for "WebSocket" and install a WebSocket client plugin (like "WebSocketKing" or similar)

## Step 2: Connect to WebSocket Server

1. Enter the WebSocket URL: `ws://localhost:8011`
2. Click "Connect" to establish the WebSocket connection

## Step 3: Authentication (Only needed for non-dev environment)

In development mode, you can bypass authentication using the dev token. If you're in production mode, you'll need to authenticate first:

1. Send a JSON message for login:
```json
{
  "type": "controller",
  "name": "Auth",
  "action": "login",
  "parameters": {
    "username": "YOUR_USERNAME",
    "password": "YOUR_PASSWORD"
  },
  "requestId": "login-1"
}
```

2. You'll receive a response with a token:
```json
{
  "success": true,
  "type": "controller",
  "data": {
    "success": true,
    "token": "YOUR_JWT_TOKEN",
    "user": {
      "id": 1,
      "username": "admin",
      "name": "Administrator",
      "email": "admin@example.com",
      "isAdmin": true
    }
  },
  "requestId": "login-1"
}
```

3. Save this token for subsequent requests

## Step 4: Call Test.performTest Method

### Option 1: Using development mode token:

```json
{
  "type": "controller",
  "name": "Test",
  "action": "performTest",
  "parameters": {
    "testParam1": "Hello",
    "testParam2": "World"
  },
  "token": "dev-token-bypass-auth-123456",
  "requestId": "test-1"
}
```

### Option 2: Using actual JWT token:

```json
{
  "type": "controller",
  "name": "Test",
  "action": "performTest",
  "parameters": {
    "testParam1": "Hello",
    "testParam2": "World"
  },
  "token": "YOUR_JWT_TOKEN",
  "requestId": "test-1"
}
```

## Step 5: Expected Response

You should receive a response like:

```json
{
  "success": true,
  "message": "Operation succeeded",
  "requestId": "test-1",
  "result": {
    "success": true,
    "testResult": "Performed test with Hello and World",
    "timestamp": "2023-05-28T12:34:56.789Z"
  }
}
```

## Alternative: Using sendWelcomeMail Method

You can also call the sendWelcomeMail method:

```json
{
  "type": "controller",
  "name": "Test",
  "action": "sendWelcomeMail",
  "parameters": {
    "body": "Welcome to our platform!",
    "subject": "Welcome Email"
  },
  "token": "dev-token-bypass-auth-123456",
  "requestId": "mail-1"
}
```

## Troubleshooting

- Ensure server is running (`node server/index.js`)
- Check connection status in Postman
- Verify request format (valid JSON)
- Check server logs for any error messages