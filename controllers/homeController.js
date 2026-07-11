const db = require("../config/db");

exports.getPaymentTypes = async (req, res) => {
    let conn;
    try {
        conn = await db.getConnection();

        const sql = `
            select id,name from payment_type
        `;

        const [rows] = await db.execute(sql);

        res.json({
            success: true,
            data: rows,
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ data: "failed", error: e.message });
    } finally {
        if (conn) conn.release();

    }

}






/**
 * POST /api/billing/entry
 *
 * Creates a complete billing entry including:
 *   - auto-create factory or retailer if id not provided (based on product_type_id)
 *   - product upsert (per product name)
 *   - product_item insert (per product)
 *   - billing header insert (with auto bill_no)
 *   - billing_item insert (one billing_item row, product_item_ids stored as "1,2,3")
 *
 * product_type_id == 1 → factory flow
 *   factory_id provided   → use it directly
 *   factory_id null       → auto-create factory using factory_name
 *                           code format: first 2 letters of name + 3-digit seq (e.g. SE001)
 *
 * product_type_id == 2 → retailer flow
 *   retailer_id provided  → use it directly
 *   retailer_id null      → auto-create retailer using retailer_name
 *                           code format: first 2 letters of name + 3-digit seq (e.g. GA001)
 *
 * Request Body:
 * {
 *   "factory_id": 1,          // optional if factory_name provided (product_type_id == 1)
 *   "factory_name": "Senco",  // used to auto-create factory when factory_id is null
 *   "retailer_id": 2,         // optional if retailer_name provided (product_type_id == 2)
 *   "retailer_name": "Ganesh",// used to auto-create retailer when retailer_id is null
 *   "payment_method_id": 1,
 *   "solid_gold_given": 40.000,
 *   "product_type_id": 1,
 *   "status_id": 1,
 *   "remarks": "optional note",
 *   "products": [
 *     {
 *       "quantity": 1,
 *       "metal_id": 1,
 *       "product_name": "Bangles",
 *       "item_code": "ITM-001",
 *       "purity": 68.00,
 *       "carat": 22.00,
 *       "gross_weight_before": 34.000,
 *       "gross_weight_after": 33.500,
 *       "factory_weight": 1.500,
 *       "net_weight": 89.000,
 *       "amount": 78.00
 *     }
 *   ]
 * }
 */
exports.createBillingEntry = async (req, res) => {
    let conn;

    try {
        conn = await db.getConnection();

        // ── Destructure request body ───────────────────────────────────────
        const {
            factory_id = null,
            factory_name = null,
            retailer_id = null,
            retailer_name = null,
            payment_method_id,
            solid_gold_given = null,
            product_type_id,
            status_id,
            remarks = null,
            products,
        } = req.body;

        // ── Validation ────────────────────────────────────────────────────

        if (!payment_method_id) {
            return res.status(400).json({
                success: false,
                message: "payment_method_id is required",
            });
        }

        if (!product_type_id) {
            return res.status(400).json({
                success: false,
                message: "product_type_id is required",
            });
        }

        // if (!status_id) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "status_id is required",
        //     });
        // }

        // Validate factory / retailer depending on product_type_id
        if (product_type_id == 1 && !factory_id && !factory_name) {
            return res.status(400).json({
                success: false,
                message: "product_type_id is 1 (factory): provide factory_id or factory_name",
            });
        }

        if (product_type_id == 2 && !retailer_id && !retailer_name) {
            return res.status(400).json({
                success: false,
                message: "product_type_id is 2 (retailer): provide retailer_id or retailer_name",
            });
        }

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: "products must be a non-empty array",
            });
        }

        // Validate each product entry before starting the transaction
        for (let i = 0; i < products.length; i++) {
            const p = products[i];

            if (!p.product_name || !String(p.product_name).trim()) {
                return res.status(400).json({
                    success: false,
                    message: `products[${i}]: product_name is required`,
                });
            }
            if (!p.fig_weight || !String(p.fig_weight).trim()) {
                return res.status(400).json({
                    success: false,
                    message: `products[${i}]: fig_weight is required`,
                });
            }

            // if (!p.item_code || !String(p.item_code).trim()) {
            //     return res.status(400).json({
            //         success: false,
            //         message: `products[${i}]: item_code is required`,
            //     });
            // }

            if (!p.metal_id) {
                return res.status(400).json({
                    success: false,
                    message: `products[${i}]: metal_id is required`,
                });
            }
        }

        // ── Begin transaction ─────────────────────────────────────────────
        await conn.beginTransaction();

        // Will hold the resolved factory_id or retailer_id (either passed in or auto-created)
        let resolvedFactoryId = factory_id ? factory_id : null;
        let resolvedRetailerId = retailer_id ? retailer_id : null;


        // ─────────────────────────────────────────────────────────────────
        // STEP 0A — Factory resolution (only when product_type_id == 1)
        //
        // factory_id provided → use it directly (resolvedFactoryId already set above)
        // factory_id null     → auto-create factory using factory_name
        //   Code: first 2 letters uppercase + 3-digit sequence (e.g. SE001, SE002)
        //   Sequence is scoped per prefix — SE and GA each have their own counter
        // ─────────────────────────────────────────────────────────────────
        if (product_type_id == 1 && !factory_id) {

            const prefix = factory_name.trim().substring(0, 2).toUpperCase();

            const [existingFactory] = await conn.execute(
                `SELECT id FROM factory WHERE name = ? AND deleted_at IS NULL LIMIT 1`,
                [factory_name.trim()]
            );

            if (existingFactory.length > 0) {
                resolvedFactoryId = existingFactory[0].id;
            } else {

                const [latestFactory] = await conn.execute(
                    `SELECT factory_code
             FROM factory
             WHERE factory_code LIKE ?
             ORDER BY id DESC
             LIMIT 1`,
                    [`${prefix}%`]
                );

                let nextNum = 1;

                if (latestFactory.length > 0) {
                    const numericPart = latestFactory[0].factory_code.replace(/[^0-9]/g, "");
                    nextNum = parseInt(numericPart || "0", 10) + 1;
                }

                const nextFactoryCode = await conn.execute(
                    `SELECT CONCAT(?, LPAD(?, 3, '0')) AS code`,
                    [prefix, nextNum]
                );

                const factoryCode = nextFactoryCode[0][0].code;

                const [inserted] = await conn.execute(
                    `INSERT INTO factory (factory_code, name)
             VALUES (?, ?)`,
                    [factoryCode, factory_name.trim()]
                );

                resolvedFactoryId = inserted.insertId;
            }
        }
        // ─────────────────────────────────────────────────────────────────
        // STEP 0B — Retailer resolution (only when product_type_id == 2)
        //
        // retailer_id provided → use it directly (resolvedRetailerId already set above)
        // retailer_id null     → auto-create retailer using retailer_name
        //   Code: first 2 letters uppercase + 3-digit sequence (e.g. GA001, GA002)
        // ─────────────────────────────────────────────────────────────────
        if (product_type_id == 2 && !retailer_id) {

            const prefix = retailer_name.trim().substring(0, 2).toUpperCase();

            const [existingRetailer] = await conn.execute(
                `SELECT id FROM retailer WHERE name = ? AND deleted_at IS NULL LIMIT 1`,
                [retailer_name.trim()]
            );

            if (existingRetailer.length > 0) {
                resolvedRetailerId = existingRetailer[0].id;
            } else {

                const [latestRetailer] = await conn.execute(
                    `SELECT retailer_code
             FROM retailer
             WHERE retailer_code LIKE ?
             ORDER BY id DESC
             LIMIT 1`,
                    [`${prefix}%`]
                );

                let nextNum = 1;

                if (latestRetailer.length > 0) {
                    const numericPart = latestRetailer[0].retailer_code.replace(/[^0-9]/g, "");
                    nextNum = parseInt(numericPart || "0", 10) + 1;
                }

                const [codeRow] = await conn.execute(
                    `SELECT CONCAT(?, LPAD(?, 3, '0')) AS code`,
                    [prefix, nextNum]
                );

                const retailerCode = codeRow[0].code;

                const [inserted] = await conn.execute(
                    `INSERT INTO retailer (retailer_code, name)
             VALUES (?, ?)`,
                    [retailerCode, retailer_name.trim()]
                );

                resolvedRetailerId = inserted.insertId;
            }
        }
        // Collect all inserted product_item IDs across the loop
        const productItemIds = [];
        let totalAmount = 0;
        let totalNetWeight = 0;
        // ─────────────────────────────────────────────────────────────────
        // STEP 1 & 2 — Loop through each product in the request
        //   Step 1: Find existing product by name, or insert a new one
        //   Step 2: Insert a product_item row linked to that product
        // ─────────────────────────────────────────────────────────────────
        for (const product of products) {
            const {
                quantity = 1,
                metal_id,
                product_name,
                item_code,
                purity = null,
                carat = null,
                gross_weight = null,
                gross_weight_before = null,
                gross_weight_after = null,
                factory_weight = null,
                net_weight = null,
                amount = null,
                fig_weight,
            } = product;

            if(payment_method_id==2){
                amount=0
            }
            // ── STEP 1: Find or create the product ───────────────────────

            const [existingProduct] = await conn.execute(
                `SELECT id
                 FROM product
                 WHERE name = ?
                   AND deleted_at IS NULL
                 LIMIT 1`,
                [product_name.trim()]
            );

            let product_id;

            if (existingProduct.length > 0) {
                // Product already exists — reuse its id
                product_id = existingProduct[0].id;
            } else {
                // Product not found — insert a new record
                const [insertedProduct] = await conn.execute(
                    `INSERT INTO product (name)
                     VALUES (?)`,
                    [product_name.trim()]
                );
                product_id = insertedProduct.insertId;
            }

            const [insertedItem] = await conn.execute(
                `INSERT INTO product_item
                    (product_id, metal_id,product_type_id, status_id, 
                    purity, carat, gross_weight, quantity,gross_weight_before,gross_weight_after,factory_weight,net_weight,amount,fig_weight)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?)`,
                [

                    product_id,
                    metal_id,
                    product_type_id,
                    1,
                    purity,
                    carat,
                    gross_weight,
                    quantity,
                    gross_weight_before,
                    gross_weight_after,
                    factory_weight,
                    net_weight,
                    amount,
                    fig_weight

                ]
            );

            // Save only the product_item id — will be joined as "1,2,3" in Step 4
            productItemIds.push(insertedItem.insertId);
            totalAmount += amount;
            totalNetWeight += net_weight
        }

        // ─────────────────────────────────────────────────────────────────
        // STEP 3 — Auto-generate bill_no and insert billing header
        //
        // Format: BILL001, BILL002 ... BILL009, BILL010, BILL100, BILL1000
        // Logic:  Fetch latest bill_no → strip non-digits → increment → pad to 3 digits
        // ─────────────────────────────────────────────────────────────────

        const [latestBill] = await conn.execute(
            `SELECT bill_no
             FROM billing
             ORDER BY id DESC
             LIMIT 1`
        );

        let nextBillNo;

        if (latestBill.length === 0) {
            // No bills exist yet — start from BILL001
            nextBillNo = "BILL001";
        } else {
            const latestBillNo = latestBill[0].bill_no;           // e.g. "BILL009"
            const numericPart = latestBillNo.replace(/\D/g, ""); // "009"
            const nextNumber = parseInt(numericPart, 10) + 1;   // 10
            // padStart(3) keeps minimum 3 digits; numbers > 999 expand naturally
            const padded = String(nextNumber).padStart(3, "0");
            nextBillNo = `BILL${padded}`;                  // "BILL010"
        }

        const [insertedBilling] = await conn.execute(
            `INSERT INTO billing
                (bill_no, bill_date, factory_id, retailer_id, remarks,total_amount,total_net_weight,payment_type_id,gold_given)
             VALUES (?, CURRENT_DATE, ?, ?, ?,?,?,?,?)`,
            [
                nextBillNo,
                resolvedFactoryId,   // auto-created or passed-in factory_id
                resolvedRetailerId,  // auto-created or passed-in retailer_id
                remarks,
                totalAmount,
                totalNetWeight,
                payment_method_id,
                solid_gold_given
            ]
        );

        const billing_id = insertedBilling.insertId;

        // ─────────────────────────────────────────────────────────────────
        // STEP 4 — Insert billing_item rows (one row per product_item)
        //
        // ✅ Normalized design used here:
        //    Each billing_item row references ONE product_item via a proper FK.
        //    This replaces the anti-pattern of storing "1,2,3" in a VARCHAR column.
        //    Benefits: proper FK constraints, clean JOINs, indexable, queryable.
        // ─────────────────────────────────────────────────────────────────
        // Join all inserted product_item IDs as "1,2,3" — one billing_item row for the whole bill
        const productItemIdsCsv = productItemIds.join(",");

        await conn.execute(
            `INSERT INTO billing_item
                (billing_id, product_item_id)
             VALUES (?, ?)`,
            [billing_id, productItemIdsCsv]
        );

        // ── All steps succeeded — commit the transaction ──────────────────
        await conn.commit();

        return res.status(201).json({
            success: true,
            message: "Billing created successfully",
            billing_id: billing_id,
            bill_no: nextBillNo,
        });

    } catch (e) {
        // Roll back everything if any step failed
        if (conn) await conn.rollback();

        console.error("createBillingEntry error:", e);

        // Duplicate item_code detected (UNIQUE KEY on product_item.item_code)
        if (e.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Duplicate item_code — each product item must have a unique code",
                error: e.message,
            });
        }

        // A provided ID doesn't exist in its referenced table
        if (e.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({
                success: false,
                message: "Invalid reference ID — check factory_id, retailer_id, metal_id, product_type_id, or status_id",
                error: e.message,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Error creating billing",
            error: e.message,
        });

    } finally {
        // Always release the connection back to the pool
        if (conn) conn.release();
    }
};

exports.getBillingHistory = async (req, res) => {
    let conn;
    try {
        conn = await db.getConnection();
        const typeId = req.query.typeId;
        const search = req.query.search ? `%${req.query.search}%` : null;
        const limit = Math.max(1, parseInt(req.query.limit) || 10);
        const offset = Math.max(0, parseInt(req.query.offset) || 0);

        const baseWhere = `
     WHERE b.deleted_at IS NULL
       AND (
            ? IS NULL
            OR (? = 1 AND b.factory_id IS NOT NULL)
            OR (? = 2 AND b.retailer_id IS NOT NULL)
       )
       AND (
            ? IS NULL
            OR b.bill_no LIKE ?
            OR f.name LIKE ?
            OR r.name LIKE ?
       )
        `;

        const dataSql = `
            SELECT
        b.bill_no,
        pt.name as payment,
        COALESCE(f.name, r.name) as customer,
        b.created_at as bill_date,
        b.total_amount,
        b.total_net_weight
     FROM billing b
     LEFT JOIN factory f ON f.id = b.factory_id
     LEFT JOIN retailer r ON r.id = b.retailer_id
     LEFT JOIN payment_type pt ON pt.id = b.payment_type_id
     ${baseWhere}
     ORDER BY b.created_at DESC
     LIMIT ${limit} OFFSET ${offset}
        `;

        const countSql = `
            SELECT COUNT(*) as total
     FROM billing b
     LEFT JOIN factory f ON f.id = b.factory_id
     LEFT JOIN retailer r ON r.id = b.retailer_id
     ${baseWhere}
        `;

        const params = [typeId ?? null, typeId ?? null, typeId ?? null, search, search, search, search];

        const [rows] = await db.execute(dataSql, params);
        const [countRows] = await db.execute(countSql, params);

        res.json({
            success: true,
            data: rows,
            total: countRows[0]?.total ?? 0,
            limit,
            offset,
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ data: "failed", error: e.message });
    } finally {
        if (conn) conn.release();
    }
}
exports.getStockOverview = async (req, res) => {
    let conn;
    try {
        conn = await db.getConnection();
        const typeId = req.query.typeId
    
        const sql = `
           SELECT
             SUM(b.total_net_weight) AS total_net_weight,
            SUM(b.gold_given) AS total_gold_given
            FROM billing b
            WHERE b.deleted_at IS NULL 
            AND (
            ? IS NULL
            OR (? = 1 AND b.factory_id IS NOT NULL)
            OR (? = 2 AND b.retailer_id IS NOT NULL)
       )
        `;

        const [rows] = await db.execute(sql, [typeId ?? null, typeId ?? null, typeId ?? null]);

        res.json({
            success: true,
            data: rows[0],
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ data: "failed", error: e.message });
    } finally {
        if (conn) conn.release();

    }

}
exports.getMetalList = async (req, res) => {
    let conn;
    try {
        conn = await db.getConnection();

        const search = req.query.search ?? "";

        const sql = `
    SELECT id, name
    FROM metal
    WHERE name LIKE ?
      AND deleted_at IS NULL
    ORDER BY name ASC
`;

        const [rows] = await db.execute(sql, [`%${search}%`]);

        res.json({
            success: true,
            count: rows.length,
            data: rows,
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ data: "failed", error: e.message });
    } finally {
        if (conn) conn.release();
    }
};