# API_ROUTES.md - RESTful Endpoints & OpenAPI Specification


> ⚠️ **BU DOSYA TASARIM BELGESİDİR, SÖZLEŞME DEĞİLDİR.**
> Gerçek API sözleşmesi: **[`API_CONTRACT.md`](./API_CONTRACT.md)** — 35 controller,
> 165 endpoint, doğrudan `packages/backend/src/modules/**/*.controller.ts` okunarak
> üretildi (`c23ce7c`). Kod üretirken **o dosyayı** kaynak al.
>
> Bu dosyadaki yollar, response şekilleri ve sayfalama örnekleri sistematik olarak koddan
> sapıyor. Sapmalar aşağıda toplu halde düzeltildi; gövdedeki tek tek bölümler **henüz
> tek tek düzeltilmedi** ve eski hallerini koruyor. Silinmediler çünkü bir kısmı
> planlanmış-ama-uygulanmamış tasarımı temsil ediyor olabilir.

---

## ⚠️ P0 DÜZELTMESİ — Bu dosyadaki sistematik sapmalar

Aşağıdaki üç sapma dosyanın **tamamı** için geçerlidir. Gövdedeki her bölümü okurken bunları
uygulayın.

### 1. Yol kalıbı — iç içe kaynak yolları kodda YOK

Bu dosya `\/stores\/:storeId\/products` gibi iç içe yollar gösteriyor. Kodda böyle bir yol yok;
controller'lar düz kaynak yolları kullanıyor ve kiracı bağlamını **HTTP başlıklarından** alıyor.

| Bu dosyadaki yol | Gerçek yol | Durum |
|---|---|---|
| `POST /stores/:storeId/products` | `POST /api/products` | PLANLANMIŞ — kodda yok |
| `GET /stores/:storeId/products` | `GET /api/products` | PLANLANMIŞ — kodda yok |
| `GET /stores/:storeId/products/:productId` | `GET /api/products/:id` | PLANLANMIŞ — kodda yok |
| `PUT /stores/:storeId/products/:productId` | `PATCH /api/products/:id` | PLANLANMIŞ — kodda yok |
| `DELETE /stores/:storeId/products/:productId` | `DELETE /api/products/:id` | PLANLANMIŞ — kodda yok |
| `GET /stores/:storeId/inventory` | `GET /api/inventory` | PLANLANMIŞ — kodda yok |
| `GET /agencies/:agencyId/clients/:clientId/stores/:storeId` | `GET /api/stores/:id` | PLANLANMIŞ — kodda yok |
| `PUT /agencies/:agencyId/clients/:clientId/stores/:storeId` | `PATCH /api/stores/:id` | PLANLANMIŞ — kodda yok |

**Kiracı bağlamı yolda değil, başlıkta taşınır:** `x-agency-id`, `x-client-id`, `x-store-id`
(`packages/frontend/src/lib/api.ts`). Sunucuda `TenantMiddleware` bunları
`req.activeAgency` / `req.activeClient` / `req.activeStore` olarak çözer.

**İki istisna** — gerçekten yolda kiracı taşıyan iki endpoint var:
`GET /api/tenants/:tenantPublicId` (`AgencyController`) ve
`GET /api/tenants/:tenantPublicId/orders` (`OrderController`).

### 2. Response zarfı — `{data, pagination}` hiçbir endpoint'te YOK

Bu dosya listeler için `{ "data": [...], "pagination": {...} }` gösteriyor. Kodda bu zarf
**hiç kullanılmıyor.** Gerçek durum:

| Gerçek şekil | Kapsam |
|---|---|
| **Düz dizi** `[...]` | Liste endpoint'lerinin ezici çoğunluğu — `/api/products`, `/api/orders`, `/api/categories`, `/api/inventory`, `/api/integrations`, `/api/agencies`, `/api/clients`, `/api/stores`, tüm `warehouse-settings` listeleri |
| **`{ items, total }`** | Yalnızca 2 endpoint: `/api/audit-logs`, `/api/integration-logs` (canlı doğrulandı) |
| `{ data, pagination }` | **Yok** |

Yani `GET /agencies` yanıtı `{data: [...], pagination: {...}}` değil, doğrudan `[...]`.

### 3. Sayfalama — sunucu tarafında YOK

Bu dosya `?page=1&limit=10&search=...&sortBy=...&sortOrder=...` query parametreleri
gösteriyor. Hiçbir liste endpoint'i böyle bir query DTO'su **almıyor**; sayfalama, filtreleme
ve arama şu an tamamen istemci tarafında yapılıyor. Sunucu tarafına taşınması **P3**'ün
görevidir; o iş bitene kadar bu bölümlerdeki query parametreleri PLANLANMIŞ sayılmalıdır.

### 4. API sürümü — `/api/v1` diye bir prefix YOK

`app.setGlobalPrefix()` çağrısı hiç yok (`packages/backend/src/main.ts`). Gerçek yol,
controller'ın `@Controller(...)` içinde yazdığı yoldur. Sürüm segmenti hiçbir yerde
kullanılmıyor.

---

## API Base URLs
- **Backend API**: `http://localhost:3001/api` (development)
- **API Documentation**: `http://localhost:3001/api/docs` (Swagger/OpenAPI)
- ~~**API Version**: `v1` (prefix: `/api/v1`)~~ → **PLANLANMIŞ — kodda yok.** Sürüm prefix'i
  uygulanmadı; bkz. yukarıdaki düzeltme §4.

---

## Authentication Endpoints

### POST `/auth/register`
**Description**: Create new user account  
**Auth**: None (public)  
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+905551234567",
  "agencyName": "XYZ Inc" // Auto-create agency for first user
}
```
**Response (201)**:
```json
{
  "id": "uuid-user-id",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "agencies": [
    {
      "id": "uuid-agency-id",
      "name": "XYZ Inc",
      "role": "admin"
    }
  ],
  "accessToken": "jwt-token-here",
  "refreshToken": "refresh-token-here"
}
```

### POST `/auth/login`
**Description**: Authenticate user  
**Auth**: None (public)  
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```
**Response (200)**:
```json
{
  "user": {
    "id": "uuid-user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "agencies": [
    {
      "id": "uuid-agency-id",
      "name": "XYZ Inc",
      "role": "admin"
    }
  ],
  "accessToken": "jwt-token-here",
  "refreshToken": "refresh-token-here"
}
```

### POST `/auth/refresh-token`
**Description**: Refresh JWT token using refresh token  
**Auth**: Refresh Token (in cookie or header)  
**Response (200)**:
```json
{
  "accessToken": "new-jwt-token",
  "refreshToken": "new-refresh-token"
}
```

### POST `/auth/logout`
**Description**: Revoke refresh token  
**Auth**: JWT Token  
**Response (200)**:
```json
{
  "message": "Logged out successfully"
}
```

### POST `/auth/switch-agency/:agencyId`
**Description**: Switch active agency for multi-tenant context  
**Auth**: JWT Token (user must have access to agencyId)  
**Response (200)**:
```json
{
  "newAccessToken": "jwt-token-with-new-agency-id",
  "currentAgency": {
    "id": "uuid-agency-id",
    "name": "XYZ Inc"
  }
}
```

---

## Agency Management

### POST `/agencies`
**Description**: Create new agency (admin only)  
**Auth**: JWT Token (Super Admin or existing Agency Admin creating sub-agency)  
**Request Body**:
```json
{
  "name": "New Agency",
  "email": "contact@agency.com",
  "phone": "+905551234567",
  "address": "123 Business St",
  "city": "Istanbul",
  "country": "TR",
  "taxId": "12345678901"
}
```
**Response (201)**:
```json
{
  "id": "uuid-agency-id",
  "name": "New Agency",
  "email": "contact@agency.com",
  "phone": "+905551234567",
  "address": "123 Business St",
  "city": "Istanbul",
  "country": "TR",
  "taxId": "12345678901",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### GET `/agencies`
**Description**: List agencies accessible to current user  
**Auth**: JWT Token  
**Query Params**:
```
?page=1&limit=10&search=query&sortBy=name&sortOrder=asc
```
**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid-agency-id",
      "name": "XYZ Inc",
      "email": "contact@xyz.com",
      "clientCount": 5,
      "storeCount": 12,
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### GET `/agencies/:id`
**Description**: Get agency details  
**Auth**: JWT Token (user must have agency access)  
**Response (200)**:
```json
{
  "id": "uuid-agency-id",
  "name": "XYZ Inc",
  "email": "contact@xyz.com",
  "phone": "+905551234567",
  "address": "123 Business St",
  "city": "Istanbul",
  "country": "TR",
  "taxId": "12345678901",
  "clientCount": 5,
  "storeCount": 12,
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-02T00:00:00Z"
}
```

### PUT `/agencies/:id`
**Description**: Update agency (agency admin only)  
**Auth**: JWT Token  
**Request Body**:
```json
{
  "name": "Updated Agency Name",
  "email": "newemail@agency.com",
  "phone": "+905559876543",
  "address": "456 New Street",
  "city": "Ankara"
}
```
**Response (200)**:
```json
{
  "id": "uuid-agency-id",
  "name": "Updated Agency Name",
  "email": "newemail@agency.com",
  "phone": "+905559876543",
  "address": "456 New Street",
  "city": "Ankara",
  "updatedAt": "2024-01-03T00:00:00Z"
}
```

---

## Client Management

### POST `/agencies/:agencyId/clients`
**Description**: Create client under agency  
**Auth**: JWT Token (agency admin or above)  
**Request Body**:
```json
{
  "name": "Department A",
  "email": "dept-a@agency.com",
  "phone": "+905551234567",
  "address": "456 Business Ave",
  "contactPerson": "Jane Smith"
}
```
**Response (201)**:
```json
{
  "id": "uuid-client-id",
  "agencyId": "uuid-agency-id",
  "name": "Department A",
  "email": "dept-a@agency.com",
  "phone": "+905551234567",
  "address": "456 Business Ave",
  "contactPerson": "Jane Smith",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### GET `/agencies/:agencyId/clients`
**Description**: List clients in agency  
**Auth**: JWT Token  
**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid-client-id",
      "name": "Department A",
      "email": "dept-a@agency.com",
      "contactPerson": "Jane Smith",
      "storeCount": 3,
      "isActive": true
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1 }
}
```

### GET `/agencies/:agencyId/clients/:clientId`
**Description**: Get client details  
**Auth**: JWT Token  
**Response (200)**: Client object with stores list

### PUT `/agencies/:agencyId/clients/:clientId`
**Description**: Update client  
**Auth**: JWT Token (client manager or above)  
**Response (200)**: Updated client object

---

## Store Management

### POST `/agencies/:agencyId/clients/:clientId/stores`
**Description**: Create store under client  
**Auth**: JWT Token (client manager or above)  
**Request Body**:
```json
{
  "name": "Main Warehouse",
  "storeCode": "WH-001",
  "address": "789 Logistics Way",
  "phone": "+905551234567",
  "managerName": "Ali Yilmaz",
  "storeType": "warehouse"
}
```
**Response (201)**:
```json
{
  "id": "uuid-store-id",
  "agencyId": "uuid-agency-id",
  "clientId": "uuid-client-id",
  "name": "Main Warehouse",
  "storeCode": "WH-001",
  "address": "789 Logistics Way",
  "phone": "+905551234567",
  "managerName": "Ali Yilmaz",
  "storeType": "warehouse",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### GET `/agencies/:agencyId/clients/:clientId/stores`
**Description**: List stores in client  
**Auth**: JWT Token  

### GET `/agencies/:agencyId/clients/:clientId/stores/:storeId`
**Description**: Get store details  
**Auth**: JWT Token  

### PUT `/agencies/:agencyId/clients/:clientId/stores/:storeId`
**Description**: Update store  
**Auth**: JWT Token (store manager or above)  

---

## Product Management

### POST `/stores/:storeId/products`
**Description**: Create product  
**Auth**: JWT Token (store manager or above)  
**Request Body**:
```json
{
  "sku": "PROD-001",
  "name": "Premium T-Shirt",
  "categoryId": "uuid-category-id",
  "description": "High-quality cotton t-shirt",
  "basePrice": 29.99,
  "costPrice": 12.00,
  "weight": 0.3,
  "barcode": "1234567890123",
  "dimensions": {
    "length": 0.6,
    "width": 0.4,
    "height": 0.05
  }
}
```
**Response (201)**: Product object with audit entry

### GET `/stores/:storeId/products`
**Description**: List products in store  
**Auth**: JWT Token  
**Query**: `?page=1&limit=20&categoryId=uuid&search=term`  

### GET `/stores/:storeId/products/:productId`
**Description**: Get product details  
**Auth**: JWT Token  

### PUT `/stores/:storeId/products/:productId`
**Description**: Update product  
**Auth**: JWT Token (store manager or above)  
**Request Body**: Partial product update  

### DELETE `/stores/:storeId/products/:productId`
**Description**: Soft delete product  
**Auth**: JWT Token (store manager or above)  
**Response (204)**: No content

---

## Category Management

### POST `/agencies/:agencyId/categories`
**Description**: Create product category  
**Auth**: JWT Token (agency admin or above)  
**Request Body**:
```json
{
  "name": "Fashion",
  "slug": "fashion",
  "parentCategoryId": null,
  "description": "Fashion products",
  "order": 1
}
```
**Response (201)**: Category object

### GET `/agencies/:agencyId/categories`
**Description**: List categories (with hierarchical tree structure)  
**Auth**: JWT Token  
**Response (200)**: Nested category array

---

## Inventory Management

### GET `/stores/:storeId/inventory`
**Description**: Get inventory levels for all products in store  
**Auth**: JWT Token  
**Query**: `?productId=uuid (optional)&includeDefective=false`  
**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid-inventory-id",
      "productId": "uuid-product-id",
      "productName": "Premium T-Shirt",
      "availableQty": 100,
      "reservedQty": 20,
      "defectiveQty": 5,
      "totalQty": 125,
      "lastCountedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### PUT `/stores/:storeId/inventory/:inventoryId/adjust`
**Description**: Adjust inventory (recount, damage, etc.)  
**Auth**: JWT Token (warehouse staff or above)  
**Request Body**:
```json
{
  "adjustType": "damage",
  "adjustQty": 5,
  "reason": "Customer return - defective"
}
```
**Response (200)**:
```json
{
  "id": "uuid-inventory-id",
  "availableQty": 95,
  "defectiveQty": 10,
  "adjustedAt": "2024-01-02T00:00:00Z"
}
```

---

## Order Management

### POST `/stores/:storeId/orders`
**Description**: Create new order  
**Auth**: JWT Token (sales rep or above)  
**Request Body**:
```json
{
  "customerName": "Ahmed Hassan",
  "customerEmail": "ahmed@example.com",
  "customerPhone": "+905551234567",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Istanbul",
    "state": "Istanbul",
    "zipCode": "34000",
    "country": "TR"
  },
  "lineItems": [
    {
      "productId": "uuid-product-id",
      "quantity": 2,
      "unitPrice": 29.99,
      "discountPercent": 10,
      "taxPercent": 18
    }
  ],
  "notes": "Urgent delivery preferred"
}
```
**Response (201)**:
```json
{
  "id": "uuid-order-id",
  "orderNumber": "ORD-20240101-001",
  "storeId": "uuid-store-id",
  "customerName": "Ahmed Hassan",
  "customerEmail": "ahmed@example.com",
  "status": "pending",
  "subtotal": 59.98,
  "taxAmount": 10.80,
  "shippingAmount": 0,
  "discountAmount": 6.00,
  "totalAmount": 64.78,
  "lineItems": [
    {
      "id": "uuid-line-item-id",
      "productId": "uuid-product-id",
      "productName": "Premium T-Shirt",
      "quantity": 2,
      "unitPrice": 29.99,
      "discountPercent": 10,
      "taxPercent": 18,
      "lineTotal": 64.78
    }
  ],
  "createdAt": "2024-01-01T00:00:00Z"
}
```
**Triggers**:
- Inventory reserved (reserved_qty += quantity)
- Audit log created
- Webhook event: `order.created`

### GET `/stores/:storeId/orders`
**Description**: List orders in store  
**Auth**: JWT Token  
**Query**: `?page=1&limit=20&status=pending&fromDate=2024-01-01&toDate=2024-12-31&search=orderNumber|customerName`  

### GET `/stores/:storeId/orders/:orderId`
**Description**: Get order details with full history  
**Auth**: JWT Token  
**Response (200)**:
```json
{
  "id": "uuid-order-id",
  "orderNumber": "ORD-20240101-001",
  "status": "pending",
  "totalAmount": 64.78,
  "lineItems": [...],
  "statusHistory": [
    {
      "fromStatus": null,
      "toStatus": "pending",
      "changedBy": "Ahmed",
      "changedAt": "2024-01-01T00:00:00Z",
      "notes": "Order created"
    }
  ]
}
```

### PATCH `/stores/:storeId/orders/:orderId/status`
**Description**: Update order status  
**Auth**: JWT Token (warehouse staff or above)  
**Request Body**:
```json
{
  "status": "processing",
  "notes": "Started picking items"
}
```
**Response (200)**:
```json
{
  "id": "uuid-order-id",
  "status": "processing",
  "statusUpdatedAt": "2024-01-02T10:30:00Z"
}
```
**Triggers**:
- Status history entry created
- If status == "shipped": inventory reserved → used
- Webhook event: `order.updated`
- Audit log created

### DELETE `/stores/:storeId/orders/:orderId`
**Description**: Cancel order (only if pending)  
**Auth**: JWT Token (store manager or above)  
**Request Body**:
```json
{
  "reason": "Customer request"
}
```
**Response (200)**: Order status updated to "cancelled", inventory unreserved

---

## Integration & Queue Management

### GET `/agencies/:agencyId/integrations`
**Description**: List configured integrations  
**Auth**: JWT Token (agency admin)  

### POST `/agencies/:agencyId/integrations`
**Description**: Add/configure integration  
**Auth**: JWT Token (agency admin)  
**Request Body**:
```json
{
  "integrationType": "trendyol",
  "apiKey": "your-api-key",
  "apiSecret": "your-api-secret",
  "webhookUrl": "https://yourdomain.com/webhooks/trendyol"
}
```
**Note**: API key and secret are encrypted before storage

### GET `/agencies/:agencyId/integration-queues`
**Description**: List pending/completed integration jobs  
**Auth**: JWT Token (agency admin)  
**Query**: `?status=pending|processing|completed|failed&type=order_export|product_sync`  

### POST `/agencies/:agencyId/integration-queues/:queueId/retry`
**Description**: Manually retry failed job  
**Auth**: JWT Token (agency admin)  
**Response (200)**: Queue item status updated to "pending"

---

## Audit Logging

### GET `/agencies/:agencyId/audit-logs`
**Description**: List audit trail  
**Auth**: JWT Token (agency admin)  
**Query**: `?entityType=product|order&entityId=uuid&action=create|update|delete&fromDate=2024-01-01&page=1&limit=20`  
**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid-audit-log-id",
      "entityType": "product",
      "entityId": "uuid-product-id",
      "action": "update",
      "changes": {
        "basePrice": { "old": 29.99, "new": 39.99 },
        "updatedAt": { "old": "2024-01-01T00:00:00Z", "new": "2024-01-02T00:00:00Z" }
      },
      "performedBy": "Ahmed Hassan",
      "performedAt": "2024-01-02T10:30:00Z",
      "ipAddress": "192.168.1.1"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 100 }
}
```

---

## User & Role Management

### GET `/agencies/:agencyId/users`
**Description**: List users with agency access  
**Auth**: JWT Token (agency admin)  

### POST `/agencies/:agencyId/users`
**Description**: Invite/create user with role  
**Auth**: JWT Token (agency admin)  
**Request Body**:
```json
{
  "email": "newuser@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "roleId": "uuid-role-id",
  "clientId": "uuid-client-id (optional)",
  "storeId": "uuid-store-id (optional)"
}
```
**Response (201)**: User object + invitation email sent

### PUT `/agencies/:agencyId/users/:userId/role`
**Description**: Update user's role  
**Auth**: JWT Token (agency admin)  
**Request Body**:
```json
{
  "roleId": "uuid-new-role-id",
  "clientId": "uuid-client-id (optional)",
  "storeId": "uuid-store-id (optional)"
}
```

### DELETE `/agencies/:agencyId/users/:userId`
**Description**: Remove user access from agency  
**Auth**: JWT Token (agency admin)  

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid credentials or expired token"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Access denied: You do not have permission to access this resource",
  "tenantContext": {
    "requestedTenantId": "uuid-requested",
    "authorizedTenantIds": ["uuid-authorized-1", "uuid-authorized-2"]
  }
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource not found: order ORD-20240101-001"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "requestId": "req-uuid-for-tracking"
}
```

---

## OpenAPI/Swagger Integration

All endpoints are documented in OpenAPI 3.0 format at:  
`GET /api/docs` — Interactive Swagger UI  
`GET /api/docs.json` — OpenAPI JSON schema

Generated using NestJS `@nestjs/swagger` decorator on controllers.
