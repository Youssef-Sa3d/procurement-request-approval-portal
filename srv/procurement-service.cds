using { procurement.db as db } from '../db/schema';

@requires: 'authenticated-user'
service ProcurementService @(path: '/odata/v4/procurement') {
    @readonly
    entity Employees        as projection on db.Employees;

    @readonly
    entity Departments      as projection on db.Departments;

    @readonly
    entity Vendors          as projection on db.Vendors;

    @readonly
    entity Budgets          as projection on db.Budgets;

    @readonly
    entity ApprovalChain    as projection on db.ApprovalChain;

    entity PurchaseRequests as projection on db.PurchaseRequests
        actions {
            action submitRequest();
            action approveByManager(comments: String);
            action approveByHOD(comments: String);
            action approveByFinance(comments: String);
            action rejectRequest(stage: String, comments: String);
        };

    function getMyPendingApprovals(employeeID: String) returns array of PurchaseRequests;
}
