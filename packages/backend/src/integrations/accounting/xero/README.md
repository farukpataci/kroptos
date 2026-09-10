# Xero Accounting Integration (KroptOS)

## 1. Overview & Scope

- **Provider ID**: `XERO`
- **Readiness Tier**: `MOCK_READY`
- **API Surface**: Strictly **Xero Accounting API** (`https://api.xero.com/api.xro/2.0/`).
  - Sales Invoices (`ACCREC`)
  - Contacts (Customer sync)
  - Items (Product / SKU mapping)
  - Payments (`ACCREC` payment allocations)
  - Tax Rates & Multi-organization Connections (`https://api.xero.com/connections`)
- **Out of Scope**: Payroll, Files, Projects, Bank Feeds, Reports, Manual Journals, Attachments.

---

## 2. Verified Endpoints & Primary Sources

- **Authorize**: `https://login.xero.com/identity/connect/authorize`
- **Token**: `https://identity.xero.com/connect/token`
- **Connections**: `https://api.xero.com/connections`
- **Accounting API**: `https://api.xero.com/api.xro/2.0/`
  - Invoices: `POST /Invoices?unitdp=4`, `POST /Invoices/{InvoiceID}`
  - Contacts: `POST /Contacts`
  - Items: `POST /Items`
  - Payments: `POST /Payments`
  - Tax Rates: `GET /TaxRates`

---

## 3. Server-side Calculation & 3-Step Invoice Flow

Xero treats `SubTotal`, `TotalTax`, and `Total` as server-calculated, read-only fields. To ensure accounting integrity between KroptOS and Xero, KroptOS executes the **3-Step Business Central Reconciliation Pattern**:

1. **Step 1 (Draft Creation)**: Invoice is created via `POST /Invoices?unitdp=4` with `Status: 'DRAFT'`.
2. **Step 2 (Server Reconciliation)**: Server-calculated totals (`Total` and `TotalTax`) are compared against KroptOS expected amounts (`grandTotal` and `vatTotal`).
   - If absolute difference $\le 0.05$, accepted as normal rounding variation.
   - If absolute difference $> 0.05$, throws `AccountingAmountMismatchError` and blocks authorization.
3. **Step 3 (Authorization)**: Post `Status: 'AUTHORISED'` to `POST /Invoices/{InvoiceID}` to finalize the document.

---

## 4. Idempotency & Concurrency

- **Xero Idempotency-Key**: Supported on POST/PUT/PATCH, cached for 6 minutes by Xero. Deterministically generated from claim row details.
- **KroptOS DB Claim Row**: Unique database constraint (`@@unique([agencyId, storeId, type, referenceCode])`) guarantees long-term multi-year deduplication.

---

## 5. Rotating Refresh Token Semantics (Phase 0 Core Promoted)

- **Rotation**: Enabled on every refresh.
- **Grace Period**: 30 minutes (`1_800_000 ms`). If a race or network retry occurs within 30 minutes, the previous refresh token remains acceptable by Xero identity servers.
- **Inactivity Expiry**: 60 days. KroptOS automated keep-alive scheduler refreshes dormant tokens weekly.
- **Single-Flight & Order**: Managed by core `AccountingTokenStore.rotateTokenWithPolicy`. Tokens are written to the database before being returned or cached.
