using {
    cuid,
    managed
} from '@sap/cds/common';
namespace procurement.db;


// --- Enum type definitions ---

type EmployeeRole : String(30) enum {
    Employee;
    Manager;
    DepartmentHead;
    Finance
}

type VendorCategory : String(30) enum {
    IT;
    Facilities;
    Marketing;
    Operations;
    Other
}

type PurchaseRequestStatus : String(30) enum {
    Draft;
    Submitted;
    ManagerApproved;
    HODApproved;
    FinanceApproved;
    Rejected
}

type ApprovalStage : String(30) enum {
    Manager;
    DepartmentHead;
    Finance
}

type ApprovalAction : String(20) enum {
    Pending;
    Approved;
    Rejected
}


// --- Entities ---

entity Employees : cuid, managed {
    name       : String(100)   @mandatory  @title: 'Full Name';
    email      : String(150)   @mandatory  @title: 'Email Address';
    role       : EmployeeRole              @title: 'Role';
    department : Association to Departments @title: 'Department';
}

entity Departments : cuid, managed {
    name       : String(100) @mandatory  @title: 'Department Name';
    costCenter : String(20)              @title: 'Cost Center';
    managedBy  : Association to Employees @title: 'Manager';
    employees  : Composition of many Employees
                     on employees.department = $self;
}

entity Budgets : cuid, managed {
    department      : Association to Departments @mandatory  @title: 'Department';
    fiscalYear      : Integer                    @mandatory  @title: 'Fiscal Year';
    totalAmount     : Decimal(15, 2)             @mandatory  @title: 'Total Budget';
    consumedAmount  : Decimal(15, 2) default 0               @title: 'Consumed Amount';
    remainingAmount : Decimal(15, 2)                         @title: 'Remaining Amount'; // computed in handler
    currency        : String(3) default 'USD'                @title: 'Currency';
}

entity Vendors : cuid, managed {
    name     : String(100) @mandatory  @title: 'Vendor Name';
    email    : String(150)             @title: 'Email Address';
    country  : String(60)              @title: 'Country';
    currency : String(3)               @title: 'Currency';
    category : VendorCategory          @title: 'Category';
}

entity PurchaseRequests : cuid, managed {
    requestNumber : String(20)            @readonly   @title: 'Request Number'; // PR-2026-001
    title         : String(200)           @mandatory  @title: 'Title';
    requestedBy   : Association to Employees           @title: 'Requested By';
    department    : Association to Departments         @title: 'Department';
    vendor        : Association to Vendors             @title: 'Vendor';
    status        : PurchaseRequestStatus default 'Draft' @title: 'Status';
    totalAmount   : Decimal(15, 2) default 0           @title: 'Total Amount';
    currency      : String(3) default 'USD'            @title: 'Currency';
    justification : String(500)                        @title: 'Justification';
    submittedAt   : Timestamp                          @title: 'Submitted At';
    items         : Composition of many RequestItems
                        on items.request = $self;
    approvalChain : Composition of many ApprovalChain
                        on approvalChain.request = $self;
}

entity RequestItems : cuid {
    request     : Association to PurchaseRequests          @title: 'Purchase Request';
    description : String(200)    @mandatory                @title: 'Description';
    quantity    : Integer        @mandatory                @title: 'Quantity';
    unitPrice   : Decimal(15, 2) @mandatory                @title: 'Unit Price';
    amount      : Decimal(15, 2) @readonly                 @title: 'Amount'; // qty x unitPrice
    vendor      : Association to Vendors                   @title: 'Vendor'; // optional override
}

entity ApprovalChain : cuid {
    request  : Association to PurchaseRequests  @title: 'Purchase Request';
    stage    : ApprovalStage                    @title: 'Approval Stage';
    approver : Association to Employees         @title: 'Approver';
    action   : ApprovalAction default 'Pending' @title: 'Action';
    comments : String(500)                      @title: 'Comments';
    actionAt : Timestamp                        @title: 'Action Date';
}