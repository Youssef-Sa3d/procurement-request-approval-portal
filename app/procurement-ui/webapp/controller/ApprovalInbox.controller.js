sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "procurement/ui/model/formatter"
], (Controller, JSONModel, MessageBox, formatter) => {
    "use strict";

    return Controller.extend("procurement.ui.controller.ApprovalInbox", {

        formatter,

        onInit() {
            this.getView().setModel(
                new JSONModel({ requests: [], allRequests: [], pendingCount: 0 }),
                "local"
            );

            this.getOwnerComponent()
                .getRouter()
                .getRoute("ApprovalInbox")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched() {
            this._loadPendingApprovals();
        },

        async _loadPendingApprovals() {
            try {
                const oAuthModel = this.getOwnerComponent().getModel("auth");
                const sEmployeeID = oAuthModel.getProperty("/employeeID");

                const oODataModel = this.getView().getModel();
                const oOperation = oODataModel.bindContext("/getMyPendingApprovals(...)");
                oOperation.setParameter("employeeID", sEmployeeID);

                await oOperation.execute();

                const aResults = oOperation.getBoundContext().getObject().value;
                const oLocalModel = this.getView().getModel("local");
                oLocalModel.setProperty("/requests", aResults);
                oLocalModel.setProperty("/allRequests", aResults);
                oLocalModel.setProperty("/pendingCount", aResults.length);

            } catch (oError) {
                MessageBox.error(oError?.message || "Failed to load pending approvals.");
            }
        },

        onColumnListItemPress(oEvent) {
            const sID = oEvent.getSource().getBindingContext("local").getProperty("ID");
            this.getOwnerComponent().getRouter().navTo("ApprovalDetail", { requestID: sID });
        },

        onSearchFieldSearch(oEvent) {
            const sQuery = oEvent.getParameter("query").toLowerCase().trim();
            const oLocalModel = this.getView().getModel("local");
            const aAll = oLocalModel.getProperty("/allRequests");

            if (!sQuery) {
                oLocalModel.setProperty("/requests", aAll);
                return;
            }

            oLocalModel.setProperty("/requests", aAll.filter(req =>
                req.title?.toLowerCase().includes(sQuery) ||
                req.requestNumber?.toLowerCase().includes(sQuery)
            ));
        }
    });
});
