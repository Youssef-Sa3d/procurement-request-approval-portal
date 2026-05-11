sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "procurement/ui/model/formatter"
], (Controller, JSONModel, MessageToast, MessageBox, formatter) => {
    "use strict";

    return Controller.extend("procurement.ui.controller.RequestDetail", {

        formatter,

        onInit() {
            this.getOwnerComponent()
                .getRouter()
                .getRoute("RequestDetail")
                .attachPatternMatched(this._onRouteMatched, this);

            // Local model controls footer button visibility
            this.getView().setModel(
                new JSONModel({ canSubmit: false }), "local"
            );
        },

        /**
         * Bind page to the specific request by ID
         */
        _onRouteMatched(oEvent) {
            const sID = oEvent.getParameter("arguments").requestID;

            this.getView().bindElement({
                path: `/PurchaseRequests('${sID}')`,
                parameters: {
                    $expand: "items,approvalChain,department,vendor"
                },
                events: {
                    dataReceived: this._onDataReceived.bind(this)
                }
            });
        },

        /**
         * After data loads — set page title and check submit visibility
         */
        _onDataReceived() {
            const oBinding = this.getView().getElementBinding();
            if (!oBinding) return;

            const oContext = oBinding.getBoundContext();
            if (!oContext) return;

            const oData = oContext.getObject();
            if (!oData) return;

            const sTitle = oData.requestNumber || "Request Detail";

            // Set dynamic page title
            this.byId("idRequestDetailPage").setTitle(sTitle);

            // Show Submit only if Draft and user is Employee
            const sRole = this.getOwnerComponent()
                .getModel("auth").getProperty("/role");
            const canSubmit = oData.status === "Draft"
                && sRole === "Employee";

            this.getView().getModel("local")
                .setProperty("/canSubmit", canSubmit);
        },

        /**
         * Call submitRequest bound action
         */
        async onSubmit() {
            try {
                const oContext = this.getView()
                    .getElementBinding()
                    .getBoundContext();

                const oAction = this.getView().getModel()
                    .bindContext(
                        "ProcurementService.submitRequest(...)",
                        oContext
                    );

                await oAction.execute();

                MessageToast.show("Request submitted successfully.");

                // Refresh binding to show updated status
                this.getView().getElementBinding().refresh();

                // Hide submit button after action
                this.getView().getModel("local")
                    .setProperty("/canSubmit", false);

            } catch (oError) {
                MessageBox.error(
                    oError?.message || "Failed to submit request."
                );
            }
        },

        onNavBack() {
            this.getOwnerComponent()
                .getRouter()
                .navTo("RequestList");
        }
    });
});