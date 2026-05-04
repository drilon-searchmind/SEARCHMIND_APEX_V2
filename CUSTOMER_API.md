# Customer API Endpoints

This document describes the Customer API endpoints for the SEARCHMIND APEX V2 application.

## Base URL
All endpoints are relative to `/api/customers`

## Endpoints

### GET /api/customers
Get all customers (excluding archived by default)

**Response:**
```json
[
  {
    "_id": "customer_id",
    "customerName": "Test Customer Inc.",
    "parentCustomer": null,
    "createdAt": "2025-12-23T13:06:28.211Z",
    "updatedAt": "2025-12-23T13:06:28.211Z",
    "isArchived": false,
    "customerType": "Shopify",
    "CustomerSettings": {
      "metricPreference": "ROAS/POAS",
      "customerStoreValutaCode": "DKK",
      "customerClickupID": "123456789",
      "customerMetaID": "DK",
      "customerMetaIDExclude": "",
      "changeCurrency": true,
      "customerRevenueType": "total_sales",
      "shopifyUrl": "https://test-customer.myshopify.com",
      "shopifyApiPassword": "your-shopify-api-password",
      "facebookAdAccountId": "123456789012345",
      "googleAdsCustomerId": "123-456-7890"
    }
  }
]
```

### POST /api/customers
Create a new customer

**Request Body:**
```json
{
  "customerName": "New Customer Ltd.",
  "customerType": "Shopify",
  "CustomerSettings": {
    "metricPreference": "ROAS/POAS",
    "customerStoreValutaCode": "EUR",
    "shopifyUrl": "https://new-customer.myshopify.com"
  }
}
```

**Response:** Returns the created customer object

### GET /api/customers/[customerId]
Get a specific customer by ID

**Parameters:**
- `customerId`: MongoDB ObjectId of the customer

**Response:** Customer object or 404 if not found

### PUT /api/customers/[customerId]
Update an existing customer

**Parameters:**
- `customerId`: MongoDB ObjectId of the customer

**Request Body:** Partial customer object with fields to update
```json
{
  "customerName": "Updated Customer Name",
  "CustomerSettings": {
    "customerStoreValutaCode": "USD"
  }
}
```

**Response:** Updated customer object

### DELETE /api/customers/[customerId]
Archive a customer (soft delete)

**Parameters:**
- `customerId`: MongoDB ObjectId of the customer

**Response:**
```json
{
  "message": "Customer archived successfully",
  "customer": { /* archived customer object */ }
}
```

## Customer Model Schema

### Fields
- `customerName` (String, required): Name of the customer
- `parentCustomer` (ObjectId, optional): Reference to parent customer
- `createdAt` (Date): Auto-generated creation timestamp
- `updatedAt` (Date): Auto-updated modification timestamp
- `isArchived` (Boolean): Soft delete flag (default: false)
- `customerType` (String): "Shopify", "WooCommerce", or "Other" (default: "Shopify")

### CustomerSettings (Nested Object)
- `metricPreference` (String): "ROAS/POAS" or "Spendshare" (required)
- `customerStoreValutaCode` (String): Currency code (default: "DKK")
- `customerClickupID` (String): ClickUp integration ID
- `customerMetaID` (String): Meta/Facebook integration ID (default: "DK")
- `customerMetaIDExclude` (String): Meta exclusion settings
- `changeCurrency` (Boolean): Enable currency conversion (default: true)
- `customerRevenueType` (String): "total_sales" or "net_sales" (default: "total_sales")
- `shopifyUrl` (String): Shopify store URL
- `shopifyApiPassword` (String): Shopify API credentials
- `facebookAdAccountId` (String): Facebook Ads account ID
- `googleAdsCustomerId` (String): Google Ads customer ID
- `pinterestAdAccountId` (String): Pinterest Ads account ID (numeric)
- `snapchat` (Object): Snapchat integration
  - `clientId` (String): OAuth client ID
  - `organizationId` (String): Business organization UUID (not the ad account)
  - `adAccountId` (String): Ads account UUID for Marketing API stats
  - `conversionsApiToken` (String): Conversions / CAPI token (password field in UI)
  - `accessToken` (String): Marketing API bearer (~1h); per customer
  - `refreshToken`, `clientSecret` (String): Optional — used to refresh access when access token is omitted or expired

## Usage in Components

Use the `useCustomers` hook for React components:

```javascript
import { useCustomers } from '@/hooks/useCustomers';

function CustomerList() {
  const {
    customers,
    loading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer
  } = useCustomers();

  // Component logic here
}
```

## Creating Customers via Script

Use the `createCustomer.js` script to create customers programmatically:

```bash
node scripts/createCustomer.js
```

Edit the script to customize the customer data before running.