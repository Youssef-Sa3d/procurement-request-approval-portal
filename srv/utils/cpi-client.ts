import cds from "@sap/cds";
import { executeHttpRequest } from "@sap-cloud-sdk/http-client";

const log = cds.log("cpi-client");

export interface ApprovalNotificationPayload {
    requestNumber:     string;
    title:             string;
    totalAmount:       number;
    currency:          string;
    department:        string;
    requestedBy:       string;
    comments:          string;
    approverName:      string;
    nextApproverEmail: string;
    subject:           string;
}

function escXml(value: string | number): string {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function buildXml(p: ApprovalNotificationPayload): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<ApprovalNotification>
  <requestNumber>${escXml(p.requestNumber)}</requestNumber>
  <title>${escXml(p.title)}</title>
  <totalAmount>${escXml(p.totalAmount)}</totalAmount>
  <currency>${escXml(p.currency)}</currency>
  <department>${escXml(p.department)}</department>
  <requestedBy>${escXml(p.requestedBy)}</requestedBy>
  <comments>${escXml(p.comments)}</comments>
  <approverName>${escXml(p.approverName)}</approverName>
  <nextApproverEmail>${escXml(p.nextApproverEmail)}</nextApproverEmail>
  <subject>${escXml(p.subject)}</subject>
</ApprovalNotification>`;
}

export interface ERPIntegrationPayload {
    requestNumber: string;
    vendorName:    string;
    totalAmount:   number;
    currency:      string;
    department:    string;
    approvedBy:    string;
    approvedAt:    string;
    items: Array<{
        description: string;
        quantity:    number;
        unitPrice:   number;
        amount:      number;
    }>;
}

function buildErpXml(p: ERPIntegrationPayload): string {
    const itemsXml = p.items.map(item => `    <Item>
      <Description>${escXml(item.description)}</Description>
      <Quantity>${escXml(item.quantity)}</Quantity>
      <UnitPrice>${escXml(item.unitPrice)}</UnitPrice>
      <Amount>${escXml(item.amount)}</Amount>
    </Item>`).join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<PurchaseOrder>
  <Header>
    <PONumber>${escXml(p.requestNumber)}</PONumber>
    <Vendor>${escXml(p.vendorName)}</Vendor>
    <TotalAmount currency="${escXml(p.currency)}">${escXml(p.totalAmount)}</TotalAmount>
    <Department>${escXml(p.department)}</Department>
    <ApprovedBy>${escXml(p.approvedBy)}</ApprovedBy>
    <ApprovedAt>${escXml(p.approvedAt)}</ApprovedAt>
    <Status>APPROVED</Status>
  </Header>
  <Items>
${itemsXml}
  </Items>
</PurchaseOrder>`;
}

export async function sendERPIntegration(
    payload: ERPIntegrationPayload
): Promise<void> {
    try {
        const xml = buildErpXml(payload);

        await executeHttpRequest(
            { destinationName: "CPI_ERP_INTEGRATION" },
            {
                method:  "POST",
                url:     "/http/procurement/erp-integration",
                data:    xml,
                headers: { "Content-Type": "application/xml" },
            }
        );

        log.info("ERP integration sent", {
            requestNumber: payload.requestNumber,
            vendorName:    payload.vendorName,
            totalAmount:   payload.totalAmount,
        });
    } catch (err: any) {
        log.error("ERP integration failed", err.message);
    }
}

export async function sendApprovalNotification(
    payload: ApprovalNotificationPayload
): Promise<void> {
    const xml = buildXml(payload);

    await executeHttpRequest(
        { destinationName: "CPI_NOTIFICATION" },
        {
            method:  "POST",
            url:     "/http/procurement/notify",
            data:    xml,
            headers: { "Content-Type": "application/xml" },
        }
    );

    log.info("CPI notification sent", {
        requestNumber:     payload.requestNumber,
        nextApproverEmail: payload.nextApproverEmail,
        subject:           payload.subject,
    });
}
