const db = require("../config/db");

exports.dashboardSummary = async (req, res) => {
    let conn;

    try {
        conn = await db.getConnection();

        // ── Core totals ──
        // product_type 1 = Factory (money/metal going OUT to factory -> "Purchases")
        // product_type 2 = Retailer (money/metal coming IN from retailer -> "Sales")
        const totalsSql = `
            SELECT
                (SELECT COALESCE(SUM(total_amount), 0)
                 FROM billing
                 WHERE deleted_at IS NULL
                 AND retailer_id IS NOT NULL) AS total_sales,

                (SELECT COALESCE(SUM(total_amount), 0)
                 FROM billing
                 WHERE deleted_at IS NULL
                 AND factory_id IS NOT NULL) AS total_purchases,

                (
    (SELECT COALESCE(SUM(total_net_weight), 0)
     FROM billing
     WHERE deleted_at IS NULL
     AND factory_id IS NOT NULL)
    -
    (SELECT COALESCE(SUM(total_net_weight), 0)
     FROM billing
     WHERE deleted_at IS NULL
     AND retailer_id IS NOT NULL)
) AS gold_stock,

                (SELECT COALESCE(SUM(gold_given), 0)
                 FROM billing
                 WHERE deleted_at IS NULL
                 AND (factory_id IS NOT NULL OR retailer_id IS NOT NULL)) AS credit_balance,

                (SELECT COALESCE(SUM(total_amount), 0)
                 FROM billing
                 WHERE deleted_at IS NULL
                 AND factory_id IS NOT NULL) AS factory_payable
        `;

        // ⚠️ PLACEHOLDER — needs product_item columns (qty, amount, product_id)
        // to join billing_item -> product_item -> product correctly.
        const highestProductSql = `
            SELECT
                p.name AS product_name,
                0 AS total_qty,
                0 AS total_amount
            FROM product p
            LIMIT 1
        `;

        // Recent transactions — now pulls from billing directly (retailer side = sales),
        // joined to retailer for party name. Confirmed columns only.
        const recentTransactionsSql = `
            SELECT
                b.id,
                b.bill_no,
                b.bill_date,
                r.name AS party_name,
                b.total_amount AS amount,
                b.created_at AS recorded_date
            FROM billing b
            LEFT JOIN retailer r ON r.id = b.retailer_id
            WHERE b.deleted_at IS NULL
            AND b.retailer_id IS NOT NULL
            ORDER BY b.created_at DESC
            LIMIT 6
        `;

        const [totals] = await db.execute(totalsSql);
        const [highestProduct] = await db.execute(highestProductSql);
        const [recentTransactions] = await db.execute(recentTransactionsSql);

        res.json({
            success: true,
            totals: totals[0],
            highestProduct: highestProduct[0] ?? null,
            recentTransactions,
        });

    } catch (e) {
        console.error(e);

        res.status(500).json({
            success: false,
            error: e.message,
        });

    } finally {
        if (conn) conn.release();
    }
};