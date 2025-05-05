# Delivery Service API Documentation

## Base URL
```
http://your-server-url:3000
```

## Inter-Service Communication

### Communication with ms-command
This microservice (ms-livraison) communicates with ms-command through REST endpoints.

#### Get Order Details
```http
GET http://ms-command-url:3001/api/orders/:id

Response:
{
  "id": string,
  "pickup": {
    "latitude": number,
    "longitude": number
  },
  "delivery": {
    "latitude": number,
    "longitude": number
  },
  "status": string,
  "createdAt": string
}
```

#### Update Order Status
```http
PUT http://ms-command-url:3001/api/orders/:id/status
Content-Type: application/json

Request Body:
{
  "status": string,
  "driverId": string,  // Optional, only when assigning driver
  "location": {        // Optional, only when updating location
    "latitude": number,
    "longitude": number
  }
}

Response:
{
  "success": boolean,
  "message": string
}
```

## HTTP Endpoints

### Orders

#### Get All Orders
```http
GET /api/orders

Response:
[
  {
    "id": string,
    "status": string,
    "pickup": {
      "latitude": number,
      "longitude": number
    },
    "delivery": {
      "latitude": number,
      "longitude": number
    },
    "createdAt": string
  }
]
```

#### Get Order by ID
```http
GET /api/orders/:id

Response:
{
  "id": string,
  "status": string,
  "pickup": {
    "latitude": number,
    "longitude": number
  },
  "delivery": {
    "latitude": number,
    "longitude": number
  },
  "createdAt": string
}
```

#### Assign Order to Driver
```http
POST /api/orders/:id/assign
Content-Type: application/json

Request Body:
{
  "driverId": string
}

Response:
{
  "success": boolean,
  "message": string
}
```

#### Update Order Status
```http
POST /api/orders/:id/update-status
Content-Type: application/json

Request Body:
{
  "status": string
}

Response:
{
  "success": boolean,
  "message": string
}
```

#### Update Driver Location
```http
POST /api/orders/:id/update-location
Content-Type: application/json

Request Body:
{
  "latitude": number,
  "longitude": number
}

Response:
{
  "success": boolean,
  "message": string
}
```

## WebSocket Events for Mobile Application

### Connection
```javascript
const socket = io('http://ms-livraison-url:3000', {  // Connect to our delivery microservice
  transports: ['websocket'],
  autoConnect: false
});

socket.connect();
```

### Available Events

#### driverLocationUpdate
Emitted when a driver's location is updated.

**When emitted:**
- When a driver's location is updated via the `/api/orders/:id/update-location` endpoint
- When a driver starts moving towards a delivery location
- When a driver reaches a pickup or delivery location
- Every 30 seconds while a driver is actively delivering an order

```javascript
socket.on('driverLocationUpdate', (data) => {
  // data format:
  {
    "orderId": string,
    "driverId": string,
    "location": {
      "latitude": number,
      "longitude": number
    },
    "timestamp": string
  }
});
```

#### orderStatusUpdate
Emitted when an order's status changes.

**When emitted:**
- When an order status is updated via the `/api/orders/:id/update-status` endpoint
- When a driver accepts an order
- When a driver picks up the package
- When a driver delivers the package
- When an order is cancelled
- When an order fails to be delivered

```javascript
socket.on('orderStatusUpdate', (data) => {
  // data format:
  {
    "orderId": string,
    "status": string,
    "timestamp": string
  }
});
```

#### orderAssigned
Emitted when an order is assigned to a driver.

**When emitted:**
- When an order is successfully assigned to a driver via the `/api/orders/:id/assign` endpoint
- When the system automatically assigns an order to an available driver

```javascript
socket.on('orderAssigned', (data) => {
  // data format:
  {
    "orderId": string,
    "driverId": string,
    "timestamp": string
  }
});
```

### Error Handling
```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```