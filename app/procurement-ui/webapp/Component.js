sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], (UIComponent, JSONModel) => {
    "use strict";

    // Seed employees matching db/data CSV — one per role for local testing
    const SEED_EMPLOYEES = [
        { ID: "e1000000-0000-0000-0000-000000000001", name: "Alice Johnson",   role: "Employee",       department_ID: "d1000000-0000-0000-0000-000000000001" },
        { ID: "e1000000-0000-0000-0000-000000000002", name: "Bob Smith",       role: "Employee",       department_ID: "d1000000-0000-0000-0000-000000000002" },
        { ID: "e1000000-0000-0000-0000-000000000003", name: "Carol White",     role: "Manager",        department_ID: "d1000000-0000-0000-0000-000000000001" },
        { ID: "e1000000-0000-0000-0000-000000000004", name: "David Lee",       role: "DepartmentHead", department_ID: "d1000000-0000-0000-0000-000000000001" },
        { ID: "e1000000-0000-0000-0000-000000000005", name: "Eva Martinez",    role: "Finance",        department_ID: "d1000000-0000-0000-0000-000000000003" },
        { ID: "e1000000-0000-0000-0000-000000000006", name: "Frank Admin",     role: "Employee",       department_ID: "d1000000-0000-0000-0000-000000000003" }
    ];

    return UIComponent.extend("procurement.ui.Component", {

        metadata: { manifest: "json" },

        init() {
            UIComponent.prototype.init.apply(this, arguments);

            // Default to first employee (Alice — Employee role)
            const oDefault = SEED_EMPLOYEES[0];
            const oAuthModel = new JSONModel({
                role: oDefault.role,
                userName: oDefault.name,
                employeeID: oDefault.ID,
                isEmployee: oDefault.role === "Employee",
                isManager: false,
                isDepartmentHead: false,
                isFinance: false,
                // Full employee list for the role-switcher Select
                employees: SEED_EMPLOYEES
            });
            this.setModel(oAuthModel, "auth");

            this.getRouter().initialize();
        }
    });
});
