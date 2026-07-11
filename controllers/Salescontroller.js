const db = require("../config/db");

// ⚠️ payment_type table columns unconfirmed — assuming a `name` column.
// Swap `pt.name` below if your actual column differs.

exports.salesReport = async (req, res) => {
    let conn;
    try {
        conn = await db.getConnection();
        const { from, to } = req.query;
        const params = [];
        let dateFilter = "";
        if (from && to) {
            dateFilter = "AND b.bill_date BETWEEN ? AND ?";
            params.push(from, to);
        }
        const recordsSql = `
            SELECT
                b.id,
                b.bill_date AS date,
                r.name AS customer,
                b.total_net_weight AS weight,
                b.total_amount AS amount,
                pt.name AS payment,
                b.bill_no AS historyLog
            FROM billing b
            LEFT JOIN retailer r ON r.id = b.retailer_id
            LEFT JOIN payment_type pt ON pt.id = b.payment_type_id
            WHERE b.deleted_at IS NULL
            AND b.retailer_id IS NOT NULL
            ${dateFilter}
            ORDER BY b.bill_date DESC
        `;
        const totalSql = `
            SELECT COALESCE(SUM(b.total_amount), 0) AS total_sales_amount
            FROM billing b
            WHERE b.deleted_at IS NULL
            AND b.retailer_id IS NOT NULL
            ${dateFilter}
        `;
        const [records] = await db.execute(recordsSql, params);
        const [totalRows] = await db.execute(totalSql, params);

        // Attach empty products array up front so bills with no
        // billing_item rows still return "products": []
        records.forEach((r) => { r.products = []; });

        if (records.length > 0) {
            const billIds = records.map((r) => r.id);
            const placeholders = billIds.map(() => "?").join(",");

            const productsSql = `
                SELECT
                   bi.billing_id,
                    p.name AS product_name,
                    pi.amount ,
                    pi.net_weight,
                    pi.carat,
                    pi.factory_weight ,
                    pi.fig_weight ,
                    pi.gross_weight ,
                    pi.gross_weight_after ,
                    pi.gross_weight_before ,
                    pi.purity ,
                    pi.quantity ,
                    m.name as metalName
                FROM billing_item bi
                JOIN product_item pi
                    ON FIND_IN_SET(pi.id, bi.product_item_id) > 0
                    AND pi.deleted_at IS NULL
                JOIN product p
                    ON p.id = pi.product_id
                    AND p.deleted_at IS NULL
                join metal m on m.id = pi.metal_id and pi.deleted_at IS NULL
                WHERE bi.billing_id IN (${placeholders})
                AND bi.deleted_at IS NULL
                ORDER BY bi.billing_id, p.name
            `;

            const [productRows] = await db.execute(productsSql, billIds);

            // Group products by billing_id
            const productsByBillId = new Map();
            for (const row of productRows) {
                if (!productsByBillId.has(row.billing_id)) {
                    productsByBillId.set(row.billing_id, []);
                }
                productsByBillId.get(row.billing_id).push({
                    product_name: row.product_name,
                    amount: row.amount,
                    netweight: row.net_weight,
                    carat: row.carat,
                    factory_weight: row.factory_weight,
                    fig_weight: row.fig_weight,
                    gross_weight: row.gross_weight,
                    gross_weight_after: row.gross_weight_after,
                    gross_weight_before: row.gross_weight_before,
                    purity: row.purity,
                    quantity: row.quantity,
                    metalName: row.metalName,
                });
            }

            // Map onto records
            for (const record of records) {
                record.products = productsByBillId.get(record.id) || [];
            }
        }

        res.json({
            success: true,
            totalSalesAmount: totalRows[0].total_sales_amount,
            records,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (conn) conn.release();
    }
};