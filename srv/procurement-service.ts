import cds from "@sap/cds";
import { sendApprovalNotification, sendERPIntegration } from "./utils/cpi-client";

const log = cds.log("procurement-service");

module.exports = class ProcurementService extends cds.ApplicationService {
    async init() {
        const { PurchaseRequests, RequestItems, ApprovalChain, Budgets, Employees, Departments, Vendors } =
            this.entities;

        // ── BEFORE handlers ─────────────────────────────────────────────

        this.before("CREATE", "PurchaseRequests", async (req: cds.Request) => {
            const year = new Date().getFullYear();
            const count = await SELECT.one`count(*) as c`.from(PurchaseRequests);
            req.data.requestNumber = `PR-${year}-${String(count.c + 1).padStart(3, "0")}`;
            req.data.status = "Draft";
        });

        this.before("CREATE", "RequestItems", async (req: cds.Request) => {
            const { quantity, unitPrice } = req.data;
            req.data.amount = (quantity || 0) * (unitPrice || 0);
        });

        // ── ON handlers (actions) ────────────────────────────────────────

        this.on("submitRequest", "PurchaseRequests", async (req: cds.Request) => {
            const { ID } = req.params[0] as { ID: string };
            const pr = await SELECT.one.from(PurchaseRequests)
                .where({ ID })
                .columns('status', 'requestNumber', 'title', 'totalAmount',
                         'currency', 'department_ID', 'requestedBy_ID');
            if (!pr) return req.error(404, 'Request not found');
            if (pr.status !== 'Draft')
                return req.error(409, 'Only Draft requests can be submitted');
            if (!pr.totalAmount || pr.totalAmount <= 0)
                return req.error(400, 'Request must have at least one item');
            // Budget check
            const budget = await SELECT.one.from(Budgets)
                .where({ department_ID: pr.department_ID, fiscalYear: new Date().getFullYear() });
            if (budget) {
                const remaining = budget.totalAmount - budget.consumedAmount;
                if (pr.totalAmount > remaining)
                    return req.error(400,
                        `Exceeds budget. Remaining: ${remaining} ${budget.currency}`);
            }
            await UPDATE(PurchaseRequests).set({
                status: 'Submitted', submittedAt: new Date()
            }).where({ ID });
            await INSERT.into(ApprovalChain).entries({
                request_ID: ID,
                stage: 'Manager', action: 'Pending'
            });

            // CPI notification — failure must never block the submission
            try {
                const [manager, requester, department] = await Promise.all([
                    SELECT.one.from(Employees)
                        .where({ role: 'Manager', department_ID: pr.department_ID })
                        .columns('name', 'email'),
                    SELECT.one.from(Employees)
                        .where({ ID: pr.requestedBy_ID })
                        .columns('name'),
                    SELECT.one.from(Departments)
                        .where({ ID: pr.department_ID })
                        .columns('name'),
                ]);
                if (manager) {
                    await sendApprovalNotification({
                        requestNumber:     pr.requestNumber,
                        title:             pr.title,
                        totalAmount:       pr.totalAmount,
                        currency:          pr.currency,
                        department:        department?.name ?? '',
                        requestedBy:       requester?.name ?? '',
                        comments:          '',
                        approverName:      manager.name,
                        nextApproverEmail: manager.email,
                        subject:           `Approval Required: ${pr.requestNumber}`,
                    });
                }
            } catch (err: any) {
                log.error('CPI notification failed (submitRequest)', err.message);
            }
        });

        this.on("approveByManager", "PurchaseRequests", async (req: cds.Request) => {
            const { ID } = req.params[0] as { ID: string };
            const { comments } = req.data;

            const pr = await SELECT.one.from(PurchaseRequests)
                .where({ ID })
                .columns('status');
            if (!pr) return req.error(404, 'Request not found');

            if (pr.status !== 'Submitted')
                return req.error(409, 'Request must be in Submitted status for Manager approval');

            await UPDATE(PurchaseRequests)
                .set({ status: 'ManagerApproved' })
                .where({ ID });

            await UPDATE(ApprovalChain)
                .set({ action: 'Approved', comments, actionAt: new Date() })
                .where({ request_ID: ID, stage: 'Manager', action: 'Pending' });

            await INSERT.into(ApprovalChain).entries({
                request_ID: ID,
                stage: 'DepartmentHead',
                action: 'Pending'
            });

            // CPI notification
            try {
                const [hod, prFull, dept] = await Promise.all([
                    SELECT.one.from(Employees)
                        .where({ role: 'DepartmentHead' })
                        .columns('name', 'email'),
                    SELECT.one.from(PurchaseRequests)
                        .where({ ID })
                        .columns('requestNumber', 'title', 'totalAmount',
                                 'currency', 'requestedBy_ID', 'department_ID'),
                    SELECT.one.from(Departments)
                        .where({ ID: pr.department_ID })
                        .columns('name'),
                ]);
                const requester = await SELECT.one.from(Employees)
                    .where({ ID: prFull.requestedBy_ID })
                    .columns('name');
                if (hod) {
                    await sendApprovalNotification({
                        requestNumber:     prFull.requestNumber,
                        title:             prFull.title,
                        totalAmount:       prFull.totalAmount,
                        currency:          prFull.currency,
                        department:        dept?.name ?? '',
                        requestedBy:       requester?.name ?? '',
                        comments:          comments ?? '',
                        approverName:      hod.name,
                        nextApproverEmail: hod.email,
                        subject:           `Approval Required: ${prFull.requestNumber}`,
                    });
                }
            } catch (err: any) {
                log.error('CPI notification failed (approveByManager)', err.message);
            }
        });

        this.on("approveByHOD", "PurchaseRequests", async (req: cds.Request) => {
            const { ID } = req.params[0] as { ID: string };
            const { comments } = req.data;

            const pr = await SELECT.one.from(PurchaseRequests)
                .where({ ID })
                .columns('status');
            if (!pr) return req.error(404, 'Request not found');

            if (pr.status !== 'ManagerApproved')
                return req.error(409, 'Request must be Manager Approved before HOD approval');

            await UPDATE(PurchaseRequests)
                .set({ status: 'HODApproved' })
                .where({ ID });

            await UPDATE(ApprovalChain)
                .set({ action: 'Approved', comments, actionAt: new Date() })
                .where({ request_ID: ID, stage: 'DepartmentHead', action: 'Pending' });

            await INSERT.into(ApprovalChain).entries({
                request_ID: ID,
                stage: 'Finance',
                action: 'Pending'
            });

            // CPI notification
            try {
                const [finance, prFull, dept] = await Promise.all([
                    SELECT.one.from(Employees)
                        .where({ role: 'Finance' })
                        .columns('name', 'email'),
                    SELECT.one.from(PurchaseRequests)
                        .where({ ID })
                        .columns('requestNumber', 'title', 'totalAmount',
                                 'currency', 'requestedBy_ID', 'department_ID'),
                    SELECT.one.from(Departments)
                        .where({ ID: pr.department_ID })
                        .columns('name'),
                ]);
                const requester = await SELECT.one.from(Employees)
                    .where({ ID: prFull.requestedBy_ID })
                    .columns('name');
                if (finance) {
                    await sendApprovalNotification({
                        requestNumber:     prFull.requestNumber,
                        title:             prFull.title,
                        totalAmount:       prFull.totalAmount,
                        currency:          prFull.currency,
                        department:        dept?.name ?? '',
                        requestedBy:       requester?.name ?? '',
                        comments:          comments ?? '',
                        approverName:      finance.name,
                        nextApproverEmail: finance.email,
                        subject:           `Final Approval Required: ${prFull.requestNumber}`,
                    });
                }
            } catch (err: any) {
                log.error('CPI notification failed (approveByHOD)', err.message);
            }
        });

        this.on("approveByFinance", "PurchaseRequests", async (req: cds.Request) => {
            const { ID } = req.params[0] as { ID: string };
            const { comments } = req.data;

            const pr = await SELECT.one.from(PurchaseRequests)
                .where({ ID })
                .columns('status', 'totalAmount', 'department_ID');
            if (!pr) return req.error(404, 'Request not found');

            if (pr.status !== 'HODApproved')
                return req.error(409, 'Request must be HOD Approved before Finance approval');

            await UPDATE(PurchaseRequests)
                .set({ status: 'FinanceApproved' })
                .where({ ID });

            await UPDATE(ApprovalChain)
                .set({ action: 'Approved', comments, actionAt: new Date() })
                .where({ request_ID: ID, stage: 'Finance', action: 'Pending' });

            await UPDATE(Budgets)
                .set`consumedAmount = consumedAmount + ${pr.totalAmount}`
                .where({ department_ID: pr.department_ID, fiscalYear: new Date().getFullYear() });

            // ERP integration — send PO to backend system
            const [prERP, itemsERP] = await Promise.all([
                SELECT.one.from(PurchaseRequests)
                    .where({ ID })
                    .columns('requestNumber', 'totalAmount', 'currency',
                             'department_ID', 'vendor_ID'),
                SELECT.from(RequestItems)
                    .where({ request_ID: ID })
                    .columns('description', 'quantity', 'unitPrice', 'amount'),
            ]);
            const [vendorERP, deptERP, financeERP] = await Promise.all([
                prERP?.vendor_ID
                    ? SELECT.one.from(Vendors).where({ ID: prERP.vendor_ID }).columns('name')
                    : Promise.resolve(null),
                SELECT.one.from(Departments)
                    .where({ ID: prERP?.department_ID }).columns('name'),
                SELECT.one.from(Employees)
                    .where({ role: 'Finance' }).columns('name'),
            ]);
            await sendERPIntegration({
                requestNumber: prERP?.requestNumber ?? '',
                vendorName:    vendorERP?.name ?? 'Unknown Vendor',
                totalAmount:   prERP?.totalAmount ?? 0,
                currency:      prERP?.currency ?? 'USD',
                department:    deptERP?.name ?? '',
                approvedBy:    financeERP?.name ?? 'Finance',
                approvedAt:    new Date().toISOString(),
                items:         (itemsERP ?? []).map((i: any) => ({
                    description: i.description,
                    quantity:    i.quantity,
                    unitPrice:   i.unitPrice,
                    amount:      i.amount,
                })),
            });

            // CPI notification — inform requester of final approval
            try {
                const requester = await SELECT.one.from(Employees)
                    .where({ ID: pr.requestedBy_ID })
                    .columns('name', 'email');
                const prFull = await SELECT.one.from(PurchaseRequests)
                    .where({ ID })
                    .columns('requestNumber', 'title', 'totalAmount', 'currency', 'department_ID');
                const dept = await SELECT.one.from(Departments)
                    .where({ ID: prFull.department_ID })
                    .columns('name');
                if (requester) {
                    await sendApprovalNotification({
                        requestNumber:     prFull.requestNumber,
                        title:             prFull.title,
                        totalAmount:       prFull.totalAmount,
                        currency:          prFull.currency,
                        department:        dept?.name ?? '',
                        requestedBy:       requester.name,
                        comments:          comments ?? '',
                        approverName:      requester.name,
                        nextApproverEmail: requester.email,
                        subject:           `Your Request ${prFull.requestNumber} Has Been Approved`,
                    });
                }
            } catch (err: any) {
                log.error('CPI notification failed (approveByFinance)', err.message);
            }
        });

        this.on("rejectRequest", "PurchaseRequests", async (req: cds.Request) => {
            const { ID } = req.params[0] as { ID: string };
            const { stage, comments } = req.data;

            const pr = await SELECT.one.from(PurchaseRequests).where({ ID });
            if (!pr) return req.error(404, 'Request not found');

            const rejectableStatuses =
                ['Submitted', 'ManagerApproved', 'HODApproved'];
            if (!rejectableStatuses.includes(pr.status))
                return req.error(409, 'Cannot reject in current status');
            await UPDATE(PurchaseRequests)
                .set({ status: 'Rejected' }).where({ ID });
            await UPDATE(ApprovalChain)
                .set({ action: 'Rejected', comments, actionAt: new Date() })
                .where({ request_ID: ID, stage, action: 'Pending' });
        });

        // ── AFTER handlers ────────────────────────────────────────────────

        this.after("READ", "Budgets", (results: any) => {
            for (const b of [results].flat()) {
                if (b) b.remainingAmount = (b.totalAmount || 0) - (b.consumedAmount || 0);
            }
        });

        this.after("CREATE", "RequestItems", async (data: any, _req: cds.Request) => {
            // Get the parent request ID from the created item
            const sRequestID = data.request_ID;
            if (!sRequestID) return;

            // Sum all items for this request
            const items = await SELECT.from(RequestItems)
                .where({ request_ID: sRequestID });
            const total = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);

            // Update the parent request totalAmount
            await UPDATE(PurchaseRequests)
                .set({ totalAmount: total })
                .where({ ID: sRequestID });
        });

        // ── Unbound functions ─────────────────────────────────────────────

        this.on("getMyPendingApprovals", async (req: cds.Request) => {
            const { employeeID } = req.data;

            const employee = await SELECT.one.from(Employees)
                .where({ ID: employeeID })
                .columns('role');

            if (!employee)
                return req.error(404, `Employee ${employeeID} not found`);

            const statusMap: Record<string, string> = {
                Manager: 'Submitted',
                DepartmentHead: 'ManagerApproved',
                Finance: 'HODApproved',
            };

            const targetStatus = statusMap[employee.role];
            if (!targetStatus) return [];

            return await SELECT.from(PurchaseRequests)
                .where({ status: targetStatus })
                .columns('ID', 'requestNumber', 'title', 'totalAmount',
                    'currency', 'submittedAt', 'department_ID');
        });

        await super.init();
    }
}