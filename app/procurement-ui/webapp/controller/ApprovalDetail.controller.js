sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "procurement/ui/model/formatter"
], (Controller, JSONModel, Fragment, MessageToast, MessageBox, formatter) => {
    "use strict";

    return Controller.extend("procurement.ui.controller.ApprovalDetail", {

        formatter,

        // Store dialog instance — load once, reuse forever
        _oDialog: null,

        onInit() {
            this.getOwnerComponent()
                .getRouter()
                .getRoute("ApprovalDetail")
                .attachPatternMatched(this._onRouteMatched, this);

            // Local model for dialog state
            this.getView().setModel(
                new JSONModel({
                    dialog: {
                        title: "",
                        message: "",
                        state: "None",
                        confirmType: "Emphasized",
                        comments: "",
                        commentsRequired: false,
                        action: ""
                    }
                }), "local"
            );
        },

        _onRouteMatched(oEvent) {
            const sID = oEvent.getParameter("arguments").requestID;

            this.getView().bindElement({
                path: `/PurchaseRequests('${sID}')`,
                parameters: {
                    $expand: "items,approvalChain,department,vendor,requestedBy"
                },
                events: {
                    dataReceived: this._onDataReceived.bind(this)
                }
            });
        },

        _onDataReceived() {
            const oBinding = this.getView().getElementBinding();
            if (!oBinding) return;
            const oContext = oBinding.getBoundContext();
            if (!oContext) return;
            const oData = oContext.getObject();
            if (!oData) return;

            const sNumber = oData.requestNumber;
            this.byId("idApprovalDetailPage").setTitle(sNumber || "Approval Detail");
        },

        /**
         * Open dialog configured for Approve action
         */
        onApprove() {
            this.getView().getModel("local").setProperty("/dialog", {
                title: "Approve Request",
                message: "Are you sure you want to approve this request?",
                state: "Success",
                confirmType: "Accept",
                comments: "",
                commentsRequired: false,
                action: "approve"
            });
            this._openDialog();
        },

        /**
         * Open dialog configured for Reject action
         */
        onReject() {
            this.getView().getModel("local").setProperty("/dialog", {
                title: "Reject Request",
                message: "Please provide a reason for rejection.",
                state: "Error",
                confirmType: "Reject",
                comments: "",
                commentsRequired: true,
                action: "reject"
            });
            this._openDialog();
        },

        /**
         * Load fragment once, open every time
         */
        async _openDialog() {
            if (!this._oDialog) {
                this._oDialog = await Fragment.load({
                    id: this.getView().getId(),
                    name: "procurement.ui.fragment.ActionDialog",
                    controller: this
                });
                this.getView().addDependent(this._oDialog);
            }
            this._oDialog.open();
        },

        /**
         * Confirm — call the correct CAP action based on dialog state
         */
        async onConfirmAction() {
            const oLocalModel = this.getView().getModel("local");
            const oDialog = oLocalModel.getProperty("/dialog");
            const sComments = oDialog.comments.trim();

            // Validate comments on reject
            if (oDialog.commentsRequired && !sComments) {
                MessageBox.error("Comments are required for rejection.");
                return;
            }

            try {
                const oContext = this.getView()
                    .getElementBinding()
                    .getBoundContext();
                const oODataModel = this.getView().getModel();
                const sRole = this.getOwnerComponent()
                    .getModel("auth")
                    .getProperty("/role");

                let sActionName;

                if (oDialog.action === "approve") {
                    sActionName = this._getApproveAction(sRole);
                    if (!sActionName) {
                        MessageBox.error("Your role cannot approve requests.");
                        return;
                    }

                    const oAction = oODataModel.bindContext(
                        `${sActionName}(...)`, oContext
                    );
                    oAction.setParameter("comments", sComments);
                    await oAction.execute();
                } else {
                    // Derive stage from the request's current status
                    const sStatus = oContext.getProperty("status");
                    const sStage = this._getStageFromStatus(sStatus);
                    if (!sStage) {
                        MessageBox.error("Cannot reject in current status.");
                        return;
                    }

                    const oAction = oODataModel.bindContext(
                        "ProcurementService.rejectRequest(...)", oContext
                    );
                    oAction.setParameter("stage", sStage);
                    oAction.setParameter("comments", sComments);
                    await oAction.execute();
                }

                this._oDialog.close();
                MessageToast.show(
                    oDialog.action === "approve"
                        ? "Request approved successfully."
                        : "Request rejected successfully."
                );

                // Navigate back to inbox
                this.getOwnerComponent()
                    .getRouter()
                    .navTo("ApprovalInbox");

            } catch (oError) {
                MessageBox.error(
                    oError?.message || "Action failed. Please try again."
                );
            }
        },

        onCloseDialog() {
            this._oDialog.close();
        },

        /**
         * Map role → correct approve action name
         */
        _getApproveAction(sRole) {
            const map = {
                Manager: "ProcurementService.approveByManager",
                DepartmentHead: "ProcurementService.approveByHOD",
                Finance: "ProcurementService.approveByFinance"
            };
            return map[sRole];
        },

        /**
         * Map request status → active approval stage for rejection
         */
        _getStageFromStatus(sStatus) {
            const map = {
                Submitted: "Manager",
                ManagerApproved: "DepartmentHead",
                HODApproved: "Finance"
            };
            return map[sStatus];
        },

        onNavBack() {
            this.getOwnerComponent()
                .getRouter()
                .navTo("ApprovalInbox");
        }
    });
});