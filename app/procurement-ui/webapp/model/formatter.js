sap.ui.define([], () => {
    "use strict";

    return {

        /**
         * Maps request status to ObjectStatus state
         * @param {string} status
         * @returns {string} sap.ui.core.ValueState
         */
        formatStatus(status) {
            const map = {
                Draft: "None",
                Submitted: "Warning",
                ManagerApproved: "Warning",
                HODApproved: "Warning",
                FinanceApproved: "Success",
                Rejected: "Error"
            };
            return map[status] || "None";
        },

        /**
         * Maps status to a human readable text from i18n
         * @param {string} status
         * @returns {string}
         */
        formatStatusText(status) {
            const map = {
                Draft: "Draft",
                Submitted: "Submitted",
                ManagerApproved: "Manager Approved",
                HODApproved: "HOD Approved",
                FinanceApproved: "Finance Approved",
                Rejected: "Rejected"
            };
            return map[status] || status;
        },

        /**
         * Maps budget remaining % to GenericTile color
         * @param {number} remaining
         * @param {number} total
         * @returns {string} sap.m.ValueColor
         */
        formatBudgetState(remaining, total) {
            if (!total) return "None";
            const pct = remaining / total;
            if (pct > 0.5) return "Success";
            if (pct > 0.2) return "Warning";
            return "Error";
        },

        /**
         * Maps approval action to timeline item icon
         * @param {string} action
         * @returns {string} icon src
         */
        formatApprovalIcon(action) {
            const map = {
                Approved: "sap-icon://accept",
                Rejected: "sap-icon://decline",
                Pending: "sap-icon://pending"
            };
            return map[action] || "sap-icon://circle-task";
        },

        /**
         * Maps approval action to timeline item color
         * @param {string} action
         * @returns {string}
         */
        formatApprovalState(action) {
            const map = {
                Approved: "Positive",
                Rejected: "Negative",
                Pending:  "Critical"
            };
            return map[action] || "Default";
        },

        /**
         * Formats decimal amount with currency
         * @param {number} amount
         * @param {string} currency
         * @returns {string}
         */
        formatAmount(amount, currency) {
            if (!amount) return "—";
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: currency || "USD"
            }).format(amount);
        },

        /**
         * Formats timestamp to readable date
         * @param {string} date
         * @returns {string}
         */
        formatDate(date) {
            if (!date) return "—";
            return new Date(date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric"
            });
        },

        /**
         * Format pending count for display
         * @param {number} count
         * @returns {string}
         */
        formatPendingCount(count) {
                    if (!count) return "No pending approvals";
                    return `${count} Pending`;
        },

        /**
 * Calculate budget consumption percentage
 * @param {number} consumed
 * @param {number} total
 * @returns {number} 0-100
 */
        formatBudgetPercent(consumed, total) {
            if (!total) return 0;
            return Math.round((consumed / total) * 100);
        },

        /**
         * Map budget remaining to GenericTile state
         * @param {number} remaining
         * @returns {string} sap.m.LoadState
         */
        formatBudgetTileState(remaining) {
            // GenericTile state is different from ValueState
            // Loaded = normal, Failed = error, Loading = warning
            return "Loaded";
        },

        /**
         * Map budget remaining % to ValueColor for NumericContent
         * @param {number} remaining
         * @param {number} total
         * @returns {string} sap.m.ValueColor
         */
        formatBudgetValueColor(remaining, total) {
            if (!total) return "Neutral";
            const pct = remaining / total;
            if (pct > 0.5) return "Good";
            if (pct > 0.2) return "Critical";
            return "Error";
        }
    };
});