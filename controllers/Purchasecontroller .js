const db = require("../config/db");

exports.purchaseReport = async (req, res) => {
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
                f.name AS factorySource,
                b.total_net_weight AS weight,
                CASE
                    WHEN b.total_net_weight > 0
                    THEN b.total_amount / b.total_net_weight
                    ELSE 0
                END AS rate,
                b.total_amount AS total,
                b.bill_no AS historyLog
            FROM billing b
            LEFT JOIN factory f ON f.id = b.factory_id AND f.deleted_at IS NULL
            WHERE b.deleted_at IS NULL
            AND b.factory_id IS NOT NULL
            ${dateFilter}
            ORDER BY b.bill_date DESC
        `;

        const totalSql = `
            SELECT COALESCE(SUM(b.total_amount), 0) AS total_purchase_amount
            FROM billing b
            WHERE b.deleted_at IS NULL
            AND b.factory_id IS NOT NULL
            ${dateFilter}
        `;

        const [records] = await db.execute(recordsSql, params);
        const [totalRows] = await db.execute(totalSql, params);

        // Attach empty products array up front so bills with no
        // billing_item rows (or that get filtered out below) still
        // satisfy rule 5.
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
                    pi.catgory,
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
                    AND p.deleted_at IS null
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
            totalPurchaseAmount: totalRows[0].total_purchase_amount,
            records,
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (conn) conn.release();
    }
};