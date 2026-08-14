# eWay Payment Gateway NestJS Setup (`sunlitesolar_backend`)

An industry-standard **eWay Payment Gateway** integration setup built in NestJS for `sunlitesolar_backend`.

---

## 🌟 Key Features

1. **eWay Rapid API 3.1 Architecture**:
   - **Responsive Shared Page Flow**: Generates eWay `AccessCode` and redirect URL for hosted payment pages.
   - **Direct Payment Flow**: Allows server-to-server payments (using direct card data or eWay client-encrypted tokens).
   - **Transaction Query & Completion**: Verifies payment outcome post-checkout redirect.
   - **Refund Management**: Initiate transaction refunds safely.
   - **Webhook Endpoint**: Ready for asynchronous IPN/Webhook status callbacks.
2. **Smart Mock Mode (`EWAY_SANDBOX_MOCK`)**:
   - Allows full frontend and checkout testing **even before client provides eWay API credentials**.
   - Generates simulated AccessCodes, redirect URLs, and transaction responses.
   - Automatically switches to real eWay Sandbox or Production mode once API credentials are provided in `.env`.
3. **CORS & Domain Protection**:
   - Pre-configured for `https://sunlitesolar.com.au`, Netlify deployments, and local development.
4. **DTO & Validation**:
   - Uses `class-validator` and `class-transformer` for strict API payload safety.

---

## 📁 Architecture Overview

```
sunlitesolar_backend/
├── .env                              # Environment configuration (Keys, Mode, Port)
├── .env.example                      # Template configuration file
├── src/
│   ├── config/
│   │   └── eway.config.ts            # eWay Environment & Endpoint Config
│   ├── modules/
│   │   └── payment/
│   │       ├── dto/
│   │       │   ├── create-access-code.dto.ts
│   │       │   ├── complete-payment.dto.ts
│   │       │   ├── direct-payment.dto.ts
│   │       │   └── refund-payment.dto.ts
│   │       ├── interfaces/
│   │       │   └── eway.interface.ts  # eWay Rapid API TypeScript Types
│   │       ├── providers/
│   │       │   └── eway.service.ts    # eWay API Client & Mock Handler
│   │       ├── payment.controller.ts  # REST Endpoints (/api/payments/eway/*)
│   │       ├── payment.service.ts     # Payment Logic Orchestration
│   │       └── payment.module.ts      # NestJS Payment Module
│   ├── app.module.ts
│   └── main.ts                       # Entry point with CORS & Validation Pipes
```

---

## 🚀 API Endpoints

All payment endpoints are prefixed under `/api/payments/eway`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/payments/eway/config` | Returns public configuration (Public Key, Mode, Mock Status) |
| `POST` | `/api/payments/eway/create-access-code` | Initiates checkout & generates eWay `AccessCode` |
| `GET` | `/api/payments/eway/complete/:accessCode` | Verifies payment status after redirect |
| `POST` | `/api/payments/eway/direct` | Direct card payment processing |
| `POST` | `/api/payments/eway/refund` | Refund existing eWay transaction |
| `POST` | `/api/payments/eway/webhook` | eWay webhook notification listener |

---

## ⚙️ How to Connect Real eWay Credentials (When Provided)

When the client provides their eWay Merchant Credentials (from **MYeWAY Portal**):

1. Open `.env` in `sunlitesolar_backend`:
   ```env
   EWAY_API_KEY=your_real_eway_api_key
   EWAY_PASSWORD=your_real_eway_password
   EWAY_PUBLIC_API_KEY=your_real_public_key

   # Set to 'sandbox' or 'production'
   EWAY_PAYMENT_MODE=sandbox

   # Disable mock mode to use live eWay servers
   EWAY_SANDBOX_MOCK=false
   ```
2. Restart the NestJS server (`npm run start:dev`).

---

## 🏃 How to Run Backend

```bash
cd "/home/mostafiz/Documents/Premium Solar/sunlitesolar_backend"

# Run in Development Mode
npm run start:dev

# Run Build Verification
npm run build
```
