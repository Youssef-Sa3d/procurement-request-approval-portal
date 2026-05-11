# Procurement UI — SAP UI5 Frontend

Coded MVC frontend for the Procurement Request & Approval Portal. Built entirely in SAP UI5 XML views and JavaScript controllers — no Fiori Elements, no annotations-driven UI. Every view, binding, and action is hand-wired.

**Live:** https://64d23019trial-dev-procurement-portal-ui.cfapps.ap21.hana.ondemand.com

## Tech Stack

| | |
|---|---|
| UI Framework | SAP UI5 1.120.45 (OpenUI5 CDN) |
| Data Binding | OData V4 Model (`@sap/cds` backend) |
| Auth | XSUAA SSO via SAP Approuter |
| Routing | `sap.m.routing.Router` with NavContainer target |
| Theme | `sap_horizon` |

## Views

| View | Route | Who sees it |
|---|---|---|
| `RequestList` | `/` | All roles |
| `CreateRequest` | `/requests/new` | Employee |
| `RequestDetail` | `/requests/:id` | All roles |
| `ApprovalInbox` | `/approvals` | Manager / HOD / Finance |
| `ApprovalDetail` | `/approvals/:id` | Manager / HOD / Finance |
| `BudgetDashboard` | `/budgets` | Finance |

## Folder Structure

```
webapp/
├── view/                   # 6 XML views
├── controller/             # 6 controllers (one per view)
├── fragment/
│   └── ActionDialog.fragment.xml   # Approve/Reject dialog
├── model/
│   └── formatter.js        # Status colors, budget states, approval icons
├── i18n/
│   └── i18n.properties     # All UI strings
├── Component.js            # App init, auth model, router
├── manifest.json           # App descriptor, routing config, models
└── index.html              # Bootstrap — loads UI5 from CDN
xs-app.json                 # Approuter route config
ui5.yaml                    # UI5 toolchain (local dev)
```

## Key Patterns

- **Role-based visibility** — `Component.js` seeds a `JSONModel` named `auth` with the current user's role; views bind visibility to `{auth>/isManager}` etc.
- **Form state** — `CreateRequest` uses a local `JSONModel` for all form fields; submitted via OData V4 `Context.create()`
- **Route refresh** — every controller attaches `attachPatternMatched` so data reloads on every navigation, not just first mount
- **Fragment reuse** — `ActionDialog` is loaded once via `Fragment.load()` and stored on the controller; subsequent opens reuse the same instance
- **OData V4 actions** — approval/rejection calls use `oContext.execute()` on bound `OperationBinding` instances
- **Formatters** — `formatter.js` maps status strings to `ValueState`, `ValueColor`, and icon URIs used across all views

## Local Development

```sh
cd app/procurement-ui
ui5 serve
```

Open: http://localhost:8080/index.html

> Requires `cds watch` running on `localhost:4004`. The OData V4 model in `manifest.json` points to `/odata/v4/procurement/` which the UI5 toolchain proxies to the CAP backend.
