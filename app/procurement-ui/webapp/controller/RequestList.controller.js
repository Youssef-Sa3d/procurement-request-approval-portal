sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "procurement/ui/model/formatter"
], (Controller, Filter, FilterOperator, formatter) => {
    "use strict";

    return Controller.extend("procurement.ui.controller.RequestList", {

        formatter,

        onInit() {
            this.getOwnerComponent()
                .getRouter()
                .getRoute("RequestList")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched() {
            this.byId("idRequestTable")
                .getBinding("items")
                .refresh();
        },

        onNewRequestButtonPress() {
            this.getOwnerComponent()
                .getRouter()
                .navTo("CreateRequest");
        },

        onColumnListItemPress(oEvent) {
            const sID = oEvent.getSource().getBindingContext().getProperty("ID");
            this.getOwnerComponent()
                .getRouter()
                .navTo("RequestDetail", { requestID: sID });
        },

        onIconTabBarSelect(oEvent) {
            const sKey = oEvent.getParameter("key");
            const oBinding = this.byId("idRequestTable").getBinding("items");

            if (sKey === "All") {
                oBinding.filter([]);
                return;
            }

            oBinding.filter([new Filter("status", FilterOperator.EQ, sKey)]);
        },

        onSearchFieldSearch(oEvent) {
            const sQuery = oEvent.getParameter("query");
            const oBinding = this.byId("idRequestTable").getBinding("items");

            if (!sQuery) {
                oBinding.filter([]);
                return;
            }

            oBinding.filter([new Filter({
                filters: [
                    new Filter("title", FilterOperator.Contains, sQuery),
                    new Filter("requestNumber", FilterOperator.Contains, sQuery)
                ],
                and: false
            })]);
        }
    });
});
