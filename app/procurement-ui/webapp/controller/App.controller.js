sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("procurement.ui.controller.App", {

        onInit() {
            // Sync the SegmentedButton selection with the current route
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.attachRouteMatched(this._onRouteMatched, this);
        },

        /**
         * Keep the SegmentedButton in sync when navigating via back/detail pages
         */
        _onRouteMatched(oEvent) {
            const sRouteName = oEvent.getParameter("name");

            // Map detail routes back to their parent nav key
            const sNavKey = this._getNavKeyForRoute(sRouteName);
            const oSegBtn = this.byId("idNavSegmented");
            if (oSegBtn && sNavKey) {
                oSegBtn.setSelectedKey(sNavKey);
            }
        },

        /**
         * Map any route to its parent SegmentedButton key
         */
        _getNavKeyForRoute(sRoute) {
            const map = {
                RequestList: "RequestList",
                CreateRequest: "RequestList",
                RequestDetail: "RequestList",
                ApprovalInbox: "ApprovalInbox",
                ApprovalDetail: "ApprovalInbox",
                BudgetDashboard: "BudgetDashboard"
            };
            return map[sRoute] || null;
        },

        /**
         * SegmentedButton navigation handler
         */
        onNavSelect(oEvent) {
            const sKey = oEvent.getParameter("key");
            this.getOwnerComponent().getRouter().navTo(sKey);
        },

        /**
         * User/role switcher change handler
         */
        onUserChange(oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            const oCtx = oSelectedItem.getBindingContext("auth");
            const oEmployee = oCtx.getObject();

            const oAuthModel = this.getOwnerComponent().getModel("auth");
            oAuthModel.setProperty("/role", oEmployee.role);
            oAuthModel.setProperty("/userName", oEmployee.name);
            oAuthModel.setProperty("/employeeID", oEmployee.ID);
            oAuthModel.setProperty("/isEmployee", oEmployee.role === "Employee");
            oAuthModel.setProperty("/isManager", oEmployee.role === "Manager");
            oAuthModel.setProperty("/isDepartmentHead", oEmployee.role === "DepartmentHead");
            oAuthModel.setProperty("/isFinance", oEmployee.role === "Finance");
        }
    });
});
