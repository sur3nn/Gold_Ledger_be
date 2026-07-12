const db = require("../config/db");

// ─────────────────────────────────────────────────────────
// GET /api/reports/outstanding?from=YYYY-MM-DD&to=YYYY-MM-DD
// ─────────────────────────────────────────────────────────
exports.outstandingReport = async (req, res) => {
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

        const shopOwnersSql = `
            SELECT
                r.id,
                r.name,
                COALESCE(SUM(b.total_amount), 0) AS cash_balance,
                COALESCE(SUM(b.total_net_weight), 0) AS metal_balance,
                MAX(b.bill_date) AS last_updated
            FROM retailer r
            LEFT JOIN billing b
                ON b.retailer_id = r.id
                AND b.deleted_at IS NULL
                ${dateFilter}
            GROUP BY r.id, r.name
            ORDER BY cash_balance DESC
        `;

        const factoriesSql = `
            SELECT
                f.id,
                f.name AS factory_name,
                COALESCE(SUM(b.total_amount), 0) AS cash_balance,
                COALESCE(SUM(b.total_net_weight), 0) AS metal_balance,
                MAX(b.bill_date) AS last_updated
            FROM factory f
            LEFT JOIN billing b
                ON b.factory_id = f.id
                AND b.deleted_at IS NULL
                ${dateFilter}
            GROUP BY f.id, f.name
            ORDER BY cash_balance DESC
        `;

        const [shopOwners] = await db.execute(shopOwnersSql, params);
        const [factories] = await db.execute(factoriesSql, params);

        res.json({ success: true, shopOwners, factories });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (conn) conn.release();
    }
};

// ─────────────────────────────────────────────────────────
// GET /api/reports/entity-wise?from=YYYY-MM-DD&to=YYYY-MM-DD
// ─────────────────────────────────────────────────────────
exports.entityWiseReport = async (req, res) => {
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

        const shopOwnersSql = `
            SELECT
                r.id,
                r.name,
                COUNT(b.id) AS transactions,
                COALESCE(SUM(b.total_amount), 0) AS amount,
                COALESCE(SUM(b.total_net_weight), 0) AS gold_qty
            FROM retailer r
            LEFT JOIN billing b
                ON b.retailer_id = r.id
                AND b.deleted_at IS NULL
                ${dateFilter}
            GROUP BY r.id, r.name
            HAVING transactions > 0
            ORDER BY amount DESC
        `;

        const factoriesSql = `
            SELECT
                f.id,
                f.name,
                COUNT(b.id) AS transactions,
                COALESCE(SUM(b.total_amount), 0) AS amount,
                COALESCE(SUM(b.total_net_weight), 0) AS gold_qty
            FROM factory f
            LEFT JOIN billing b
                ON b.factory_id = f.id
                AND b.deleted_at IS NULL
                ${dateFilter}
            GROUP BY f.id, f.name
            HAVING transactions > 0
            ORDER BY amount DESC
        `;

        const [shopOwners] = await db.execute(shopOwnersSql, params);
        const [factories] = await db.execute(factoriesSql, params);

        res.json({ success: true, shopOwners, factories });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (conn) conn.release();
    }
};