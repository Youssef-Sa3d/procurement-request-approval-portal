# Procurement Request & Approval Portal

A full-stack SAP BTP application for managing purchase requests through a structured 3-stage approval workflow. Built with SAP CAP (TypeScript) on the backend, SAP UI5 coded MVC on the frontend, and integrated with SAP Integration Suite for email notifications and ERP purchase order delivery.

## Live Demo

| | URL |
|---|---|
| **UI** | https://64d23019trial-dev-procurement-portal-ui.cfapps.ap21.hana.ondemand.com |
| **Backend** | https://64d23019trial-dev-procurement-portal-srv.cfapps.ap21.hana.ondemand.com |

> Running on a BTP trial account — the server may be inactive during off-hours. Allow 30–60 seconds for cold start.

## Stack

| Layer | Technology |
|---|---|
| Backend | SAP CAP (Node.js + TypeScript) |
| Database | SAP HANA Cloud |
| Frontend | SAP UI5 (coded MVC) |
| Integration | SAP Integration Suite (CPI) |
| Auth | SAP BTP XSUAA |
| Deployment | SAP BTP Cloud Foundry (MTA) |

## Architecture

```
UI5 Frontend (BTP CF)
  ↓ OData V4 via Approuter
CAP Backend (BTP CF)
  ↓
HANA Cloud
  ↓ on approval actions
CPI Integration Suite
  ↓               ↓
Gmail SMTP      Mock ERP (HTTP)
```

## Key Features

- **3-stage approval workflow** — Manager → Department Head → Finance, enforced sequentially via OData bound actions
- **Budget validation** — checked on submit; consumed amount updated on Finance approval
- **CPI iFlow 1** — email notification sent to the next approver at each stage
- **CPI iFlow 2** — Finance-approved PR delivered as Purchase Order XML to ERP endpoint
- **OData V4 bound actions** — all workflow transitions exposed as typed CAP actions
- **Resilient integration** — CPI failures are caught in isolated try/catch blocks and never block approval processing

## Project Structure

```
procurement-portal/
├── db/
│   ├── schema.cds          # Entity definitions
│   └── data/               # CSV seed data
├── srv/
│   ├── procurement-service.cds   # Service definition + actions
│   ├── procurement-service.ts    # All handlers (before/on/after)
│   └── utils/
│       └── cpi-client.ts         # sendApprovalNotification + sendERPIntegration
├── app/
│   └── procurement-ui/           # UI5 app + approuter
├── xs-security.json        # XSUAA app security descriptor
└── mta.yaml                # MTA deployment descriptor
```

## Local Setup

**Prerequisites:** Node.js 18+, `@sap/cds-dk`, `@ui5/cli`

**Backend**
```sh
npm install
cds watch          # → http://localhost:4004
```

**Frontend**
```sh
cd app/procurement-ui
ui5 serve          # → http://localhost:8080/index.html
```

> For CPI calls to work locally, create `default-env.json` in the project root with your BTP destination service credentials and a `CPI_NOTIFICATION` / `CPI_ERP_INTEGRATION` destination definition.

## Data Model

| Entity | Purpose |
|---|---|
| `Employees` | Users with roles: Employee, Manager, DepartmentHead, Finance |
| `Departments` | Org units; each linked to a manager and a budget |
| `Budgets` | Annual budget per department; tracks total and consumed amounts |
| `Vendors` | Supplier master data linked to purchase requests |
| `PurchaseRequests` | The core document — tracks status through the approval lifecycle |
| `RequestItems` | Line items (description, quantity, unit price, amount) per request |
| `ApprovalChain` | Audit trail of every approval/rejection action per stage |

## API

**Service path:** `/odata/v4/procurement/`

### Bound Actions on `PurchaseRequests`

| Action | Transition | Notes |
|---|---|---|
| `submitRequest()` | Draft → Submitted | Validates total amount and budget remaining |
| `approveByManager(comments)` | Submitted → ManagerApproved | Sends CPI notification to HOD |
| `approveByHOD(comments)` | ManagerApproved → HODApproved | Sends CPI notification to Finance |
| `approveByFinance(comments)` | HODApproved → FinanceApproved | Updates budget consumed; sends PO XML to ERP |
| `rejectRequest(stage, comments)` | Any active stage → Rejected | Stage parameter identifies which chain entry to close |

### Unbound Function

| Function | Returns |
|---|---|
| `getMyPendingApprovals(employeeID)` | Requests awaiting action for the caller's role |
