sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "procurement/ui/model/formatter"
], (Controller, JSONModel, MessageToast, MessageBox, formatter) => {
    "use strict";

    return Controller.extend("procurement.ui.controller.CreateRequest", {

        formatter,

        onInit() {
            this.getOwnerComponent()
                .getRouter()
                .getRoute("CreateRequest")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        /**
         * Reset form every time page is opened
         */
        _onRouteMatched() {
            const oLocalModel = new JSONModel({
                title: "",
                department_ID: "",
                vendor_ID: "",
                currency: "USD",
                justification: "",
                totalAmount: 0,
                items: []
            });
            this.getView().setModel(oLocalModel, "local");
        },

        /**
         * Add empty row to items table
         */
        onAddItem() {
            const oModel = this.getView().getModel("local");
            const aItems = oModel.getProperty("/items");

            aItems.push({
                description: "",
                quantity: 1,
                unitPrice: 0,
                amount: 0
            });

            oModel.setProperty("/items", aItems);
        },

        /**
         * Delete item row by index
         */
        onDeleteItem(oEvent) {
            const oModel = this.getView().getModel("local");
            const aItems = oModel.getProperty("/items");
            const oContext = oEvent.getSource().getBindingContext("local");
            const sPath = oContext.getPath();
            const iIndex = parseInt(sPath.split("/").pop());

            aItems.splice(iIndex, 1);
            oModel.setProperty("/items", aItems);
            this._recalculateTotal();
        },

        /**
         * Recalculate row amount and total on qty/price change
         */
        onItemChange(oEvent) {
            const oModel = this.getView().getModel("local");
            const oContext = oEvent.getSource().getBindingContext("local");
            const sPath = oContext.getPath();
            const oItem = oModel.getProperty(sPath);

            // Recalculate this row
            oItem.amount = (oItem.quantity || 0) * (oItem.unitPrice || 0);
            oModel.setProperty(sPath, oItem);

            // Recalculate grand total
            this._recalculateTotal();
        },

        /**
         * Sum all item amounts into totalAmount
         */
        _recalculateTotal() {
            const oModel = this.getView().getModel("local");
            const aItems = oModel.getProperty("/items");
            const fTotal = aItems.reduce(
                (sum, item) => sum + (item.amount || 0), 0
            );
            oModel.setProperty("/totalAmount", fTotal);
        },

        /**
         * Validate form before save/submit
         * @returns {boolean}
         */
        _validate() {
            const oModel = this.getView().getModel("local");
            const oData = oModel.getData();

            if (!oData.title.trim()) {
                MessageBox.error("Title is required.");
                return false;
            }
            if (!oData.department_ID) {
                MessageBox.error("Please select a department.");
                return false;
            }
            if (!oData.vendor_ID) {
                MessageBox.error("Please select a vendor.");
                return false;
            }
            if (!oData.items.length) {
                MessageBox.error("Please add at least one line item.");
                return false;
            }
            const bItemsValid = oData.items.every(
                item => item.description.trim()
                    && item.quantity > 0
                    && item.unitPrice > 0
            );
            if (!bItemsValid) {
                MessageBox.error(
                    "All items need a description, quantity and unit price."
                );
                return false;
            }
            return true;
        },

        /**
         * Build header-only payload (no nested items)
         */
        _buildHeaderPayload() {
            const oModel = this.getView().getModel("local");
            const oData = oModel.getData();
            return {
                title: oData.title.trim(),
                department_ID: oData.department_ID,
                vendor_ID: oData.vendor_ID,
                currency: oData.currency,
                justification: oData.justification.trim(),
                totalAmount: oData.totalAmount
            };
        },

        /**
         * Create header, then create each item against the header's items nav.
         * This avoids the OData V4 deep-insert "No key predicate known" error.
         * @param {object} oPayload - header payload
         * @returns {sap.ui.model.odata.v4.Context} the created header context
         */
        async _createRequestWithItems(oPayload) {
            const oODataModel = this.getView().getModel();
            const oLocalModel = this.getView().getModel("local");
            const aItems = oLocalModel.getProperty("/items");

            // 1. Create the header
            const oListBinding = oODataModel.bindList("/PurchaseRequests");
            const oHeaderCtx = oListBinding.create(oPayload);
            await oHeaderCtx.created();

            // 2. Create each line item against the header's items navigation
            const sHeaderPath = oHeaderCtx.getPath();
            const oItemsBinding = oODataModel.bindList(sHeaderPath + "/items");

            for (const item of aItems) {
                const oItemCtx = oItemsBinding.create({
                    description: item.description.trim(),
                    quantity: item.quantity,
                    unitPrice: item.unitPrice
                });
                await oItemCtx.created();
            }

            return oHeaderCtx;
        },

        /**
         * Save as Draft — POST header then items, navigate back
         */
        async onSaveDraft() {
            if (!this._validate()) return;

            try {
                const oPayload = this._buildHeaderPayload();
                await this._createRequestWithItems(oPayload);

                MessageToast.show("Draft saved successfully.");
                this._navBack();

            } catch (oError) {
                MessageBox.error(
                    oError?.message || "Failed to save draft."
                );
            }
        },

        /**
         * Submit — save draft then call submitRequest action
         */
        async onSubmit() {
            if (!this._validate()) return;

            try {
                const oPayload = this._buildHeaderPayload();
                const oHeaderCtx = await this._createRequestWithItems(oPayload);

                // Call submitRequest bound action
                const oODataModel = this.getView().getModel();
                const oAction = oODataModel.bindContext(
                    "ProcurementService.submitRequest(...)",
                    oHeaderCtx
                );
                await oAction.execute();

                MessageToast.show("Request submitted successfully.");
                this._navBack();

            } catch (oError) {
                MessageBox.error(
                    oError?.message || "Failed to submit request."
                );
            }
        },

        onNavBack() {
            this._navBack();
        },

        _navBack() {
            this.getOwnerComponent()
                .getRouter()
                .navTo("RequestList");
        }
    });
});