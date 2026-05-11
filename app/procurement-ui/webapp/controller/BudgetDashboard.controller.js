sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "procurement/ui/model/formatter"
], (Controller, formatter) => {
    "use strict";

    return Controller.extend("procurement.ui.controller.BudgetDashboard", {

        formatter,

        onInit() {
            this.getOwnerComponent()
                .getRouter()
                .getRoute("BudgetDashboard")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        /**
         * Refresh budget data every time page is visited
         * so Finance approval changes reflect immediately
         */
        _onRouteMatched() {
            const oBudgetTableBinding = this.byId("idBudgetTable")
                .getBinding("items");

            if (oBudgetTableBinding) {
                oBudgetTableBinding.refresh();
            }
        }
    });
});