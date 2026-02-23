const { PrismaClient } = require("@prisma/client");
const { randomBytes } = require("crypto");

const prisma = new PrismaClient();

// Helpers
function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Data Sets
const VENDOR_NAMES = ["Apex Steel", "Zenith Alloys", "Global Polymers", "Standard Fasteners", "Eco Packaging", "Rapid Logistics", "Metro Scrap Traders"];
const CUSTOMER_NAMES = ["AutoMotive Corp", "BuildWell Infra", "TechGadgets Inc", "HomeStyle Furniture", "City Construct", "NextGen EV"];
const RAW_MATERIALS = [
    { code: "RM-001", name: "Steel Sheet 2mm", unit: "kg", cost: 65 },
    { code: "RM-002", name: "Aluminum Ingot", unit: "kg", cost: 180 },
    { code: "RM-003", name: "Plastic Granules", unit: "kg", cost: 90 },
    { code: "RM-004", name: "Copper Wire", unit: "m", cost: 45 },
    { code: "RM-005", name: "Packaging Box", unit: "pc", cost: 12 },
];
const FINISHED_GOODS = [
    { code: "FG-101", name: "Metal Enclosure Box", unit: "pc", price: 1200 },
    { code: "FG-102", name: "Alloy Wheel Rim", unit: "pc", price: 4500 },
    { code: "FG-103", name: "Plastic Casing", unit: "pc", price: 350 },
    { code: "FG-104", name: "Insulated Cable Roll", unit: "unit", price: 2200 },
];
const MACHINES = [
    { code: "M-CUT-01", name: "Laser Cutter", capacity: 5 },
    { code: "M-BEND-01", name: "Bending Machine", capacity: 8 },
    { code: "M-WELD-01", name: "Welding Station", capacity: 3 },
    { code: "M-INJ-01", name: "Injection Molder", capacity: 12 },
    { code: "M-PCK-01", name: "Packaging Line", capacity: 20 },
];

async function main() {
    console.log("Starting Full System Seed...");

    const company = await prisma.company.findFirst();
    if (!company) {
        console.error("No company found. Run base seed first.");
        return;
    }

    // 1. Create/Update Vendors
    const vendors = [];
    for (const name of VENDOR_NAMES) {
        const type = name.includes("Scrap") ? "SCRAP" : "RAW";
        const v = await prisma.vendor.upsert({
            where: { companyId_code: { companyId: company.id, code: name.slice(0, 3).toUpperCase() } },
            update: {},
            create: {
                companyId: company.id,
                code: name.slice(0, 3).toUpperCase(),
                name: name,
                vendorType: type,
                email: `contact@${name.replace(/\s/g, "").toLowerCase()}.com`,
                phone: "9876543210",
                creditDays: 30,
                gstin: "27AAAAA0000A1Z5"
            }
        });
        vendors.push(v);
    }

    // 2. Create/Update Customers
    const customers = [];
    for (const name of CUSTOMER_NAMES) {
        const c = await prisma.customer.upsert({
            where: { companyId_code: { companyId: company.id, code: name.slice(0, 3).toUpperCase() } },
            update: {},
            create: {
                companyId: company.id,
                code: name.slice(0, 3).toUpperCase(),
                name: name,
                email: `purchasing@${name.replace(/\s/g, "").toLowerCase()}.com`,
                phone: "9876543210",
                creditDays: 45,
                gstin: "27BBBBB0000B1Z5"
            }
        });
        customers.push(c);
    }

    // 3. Create Machines
    const machines = [];
    for (const m of MACHINES) {
        const machine = await prisma.machine.upsert({
            where: { companyId_code: { companyId: company.id, code: m.code } },
            update: {},
            create: {
                companyId: company.id,
                code: m.code,
                name: m.name,
                baseCapacityPerMinute: m.capacity
            }
        });
        machines.push(machine);
    }

    // 4. Create SKUs (Raw & Finished)
    const rawSkus = [];
    for (const r of RAW_MATERIALS) {
        const sku = await prisma.sku.upsert({
            where: { companyId_code: { companyId: company.id, code: r.code } },
            update: {},
            create: {
                companyId: company.id,
                code: r.code,
                name: r.name,
                unit: r.unit,
                type: "RAW_MATERIAL",
                standardCost: r.cost,
                lastPurchasePrice: r.cost,
                manufacturingCost: r.cost
            }
        });
        rawSkus.push(sku);
    }

    const finishedSkus = [];
    for (const f of FINISHED_GOODS) {
        const sku = await prisma.sku.upsert({
            where: { companyId_code: { companyId: company.id, code: f.code } },
            update: {},
            create: {
                companyId: company.id,
                code: f.code,
                name: f.name,
                unit: f.unit,
                type: "FINISHED",
                sellingPrice: f.price,
                standardCost: f.price * 0.7
            }
        });
        finishedSkus.push(sku);
    }

    // 5. Create BOMs & Routings (Mapping)
    // Simple mapping: FG-101 uses RM-001 (Sheet) + RM-005 (Box)
    const fg101 = finishedSkus.find(s => s.code === "FG-101");
    const rmSheet = rawSkus.find(s => s.code === "RM-001");
    const rmBox = rawSkus.find(s => s.code === "RM-005");

    if (fg101 && rmSheet && rmBox) {
        // BOM
        let bom = await prisma.bom.findFirst({ where: { companyId: company.id, finishedSkuId: fg101.id } });
        if (!bom) {
            bom = await prisma.bom.create({
                data: {
                    companyId: company.id,
                    finishedSkuId: fg101.id,
                    name: "Standard BOM",
                    version: 1
                }
            });
            await prisma.bomLine.createMany({
                data: [
                    { bomId: bom.id, rawSkuId: rmSheet.id, quantity: 2.5 }, // 2.5kg sheet
                    { bomId: bom.id, rawSkuId: rmBox.id, quantity: 1 }      // 1 box
                ]
            });
        }

        // Routing (Multi-machine sequence)
        let routing = await prisma.routing.findUnique({ where: { finishedSkuId: fg101.id } });
        if (!routing) {
            routing = await prisma.routing.create({
                data: { companyId: company.id, finishedSkuId: fg101.id, name: "Std Process" }
            });
            const cutter = machines.find(m => m.code === "M-CUT-01");
            const bender = machines.find(m => m.code === "M-BEND-01");
            const packer = machines.find(m => m.code === "M-PCK-01");
            if (cutter && bender && packer) {
                await prisma.routingStep.createMany({
                    data: [
                        { routingId: routing.id, machineId: cutter.id, sequence: 10, capacityPerMinute: 2 },
                        { routingId: routing.id, machineId: bender.id, sequence: 20, capacityPerMinute: 3 },
                        { routingId: routing.id, machineId: packer.id, sequence: 30, capacityPerMinute: 10 }
                    ]
                });
            }
        }
    }

    // 6. Generate Transactions
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 2);
    const now = new Date();

    // Zones
    const rawZone = await prisma.zone.findFirst({ where: { companyId: company.id, type: "RAW_MATERIAL" } });
    const finishedZone = await prisma.zone.findFirst({ where: { companyId: company.id, type: "FINISHED" } });

    // 6a. Purchase Orders (Some Received, Some Billed, Some Overdue)
    if (rawZone && rawSkus.length && vendors.length) {
        console.log("Generating POs...");
        for (let i = 0; i < 15; i++) {
            const vendor = randomItem(vendors.filter(v => v.vendorType === "RAW"));
            const poDate = randomDate(startDate, now);
            const sku = randomItem(rawSkus);
            const qty = randomInt(500, 5000);
            const price = sku.lastPurchasePrice || 100;

            // PO
            const po = await prisma.purchaseOrder.create({
                data: {
                    companyId: company.id,
                    vendorId: vendor.id,
                    poNumber: `PO-${randomBytes(4).toString("hex").toUpperCase()}`,
                    status: "CLOSED", // Assume received and closed
                    type: "RAW",
                    orderDate: poDate
                }
            });

            const poLine = await prisma.purchaseOrderLine.create({
                data: {
                    purchaseOrderId: po.id,
                    skuId: sku.id,
                    quantity: qty,
                    unitPrice: price,
                    receivedQty: qty
                }
            });

            // Goods Receipt & Stock
            const gr = await prisma.goodsReceipt.create({
                data: {
                    companyId: company.id,
                    vendorId: vendor.id,
                    purchaseOrderId: po.id,
                    receivedAt: addDays(poDate, 5) // Received 5 days later
                }
            });

            const grLine = await prisma.goodsReceiptLine.create({
                data: {
                    receiptId: gr.id,
                    poLineId: poLine.id,
                    skuId: sku.id,
                    quantity: qty,
                    costPerUnit: price,
                    totalCost: price * qty
                }
            });

            await prisma.stockLedger.create({
                data: {
                    companyId: company.id,
                    zoneId: rawZone.id,
                    skuId: sku.id,
                    quantity: qty,
                    direction: "IN",
                    movementType: "PURCHASE_RECEIPT",
                    costPerUnit: price,
                    totalCost: price * qty,
                    referenceType: "GOODS_RECEIPT",
                    createdAt: gr.receivedAt
                }
            });

            // Update Balance
            const balance = await prisma.stockBalance.findUnique({
                where: { companyId_skuId_zoneId: { companyId: company.id, zoneId: rawZone.id, skuId: sku.id } }
            });
            if (balance) {
                await prisma.stockBalance.update({
                    where: { id: balance.id },
                    data: {
                        quantityOnHand: { increment: qty },
                        totalCost: { increment: price * qty },
                        costPerUnit: (balance.totalCost + (price * qty)) / (balance.quantityOnHand + qty)
                    }
                });
            } else {
                await prisma.stockBalance.create({
                    data: {
                        companyId: company.id,
                        skuId: sku.id,
                        zoneId: rawZone.id,
                        quantityOnHand: qty,
                        totalCost: price * qty,
                        costPerUnit: price
                    }
                });
            }

            // Vendor Bill (Some UNPAID and OVERDUE)
            const isUnpaid = Math.random() > 0.5;
            const billDate = addDays(gr.receivedAt, 2);
            const dueDate = addDays(billDate, vendor.creditDays || 30);

            await prisma.vendorBill.create({
                data: {
                    companyId: company.id,
                    vendorId: vendor.id,
                    purchaseOrderId: po.id,
                    receiptId: gr.id,
                    billNumber: `BILL-${randomBytes(3).toString("hex")}`,
                    status: isUnpaid ? "UNPAID" : "PAID",
                    billDate: billDate,
                    dueDate: dueDate,
                    totalAmount: qty * price,
                    balanceAmount: isUnpaid ? qty * price : 0
                }
            });
        }
    }

    // 6b. Sales Orders -> Production
    if (finishedZone && customers.length && finishedSkus.length) {
        console.log("Generating SOs...");
        for (let i = 0; i < 20; i++) {
            const customer = randomItem(customers);
            const orderDate = randomDate(startDate, now);
            const soNumber = `SO-${randomBytes(4).toString("hex").toUpperCase()}`;
            const sku = randomItem(finishedSkus);
            const qty = randomInt(50, 500);
            const price = sku.sellingPrice || 1000;

            const so = await prisma.salesOrder.create({
                data: {
                    companyId: company.id,
                    customerId: customer.id,
                    soNumber: soNumber,
                    status: "COMPLETED",
                    orderDate: orderDate
                }
            });

            const line = await prisma.salesOrderLine.create({
                data: {
                    salesOrderId: so.id,
                    skuId: sku.id,
                    quantity: qty,
                    unitPrice: price,
                    deliveredQty: qty,
                    producedQty: qty
                }
            });

            // Production Logs (Multi-machine if routing exists)
            // For simplicity, just create one log for the last machine or a random machine
            const machine = randomItem(machines);
            if (machine) {
                await prisma.productionLog.create({
                    data: {
                        companyId: company.id,
                        machineId: machine.id,
                        finishedSkuId: sku.id,
                        salesOrderLineId: line.id,
                        plannedQty: qty,
                        goodQty: qty,
                        startAt: addDays(orderDate, 2),
                        closeAt: addDays(orderDate, 3),
                        status: "CLOSED",
                        purpose: "ORDER",
                        notes: `Production for ${soNumber}`
                    }
                });
            }

            // Stock Entry (Production Receipt)
            await prisma.stockLedger.create({
                data: {
                    companyId: company.id,
                    zoneId: finishedZone.id,
                    skuId: sku.id,
                    quantity: qty,
                    direction: "IN",
                    movementType: "PRODUCTION_RECEIPT",
                    costPerUnit: price * 0.6,
                    totalCost: (price * 0.6) * qty,
                    createdAt: addDays(orderDate, 3)
                }
            });

            // Update Balance
            const balance = await prisma.stockBalance.findUnique({
                where: { companyId_skuId_zoneId: { companyId: company.id, zoneId: finishedZone.id, skuId: sku.id } }
            });
            if (balance) {
                await prisma.stockBalance.update({
                    where: { id: balance.id },
                    data: {
                        quantityOnHand: { increment: qty },
                        totalCost: { increment: (price * 0.6) * qty },
                        costPerUnit: ((balance.totalCost + ((price * 0.6) * qty)) / (balance.quantityOnHand + qty))
                    }
                });
            } else {
                await prisma.stockBalance.create({
                    data: {
                        companyId: company.id,
                        skuId: sku.id,
                        zoneId: finishedZone.id,
                        quantityOnHand: qty,
                        totalCost: (price * 0.6) * qty,
                        costPerUnit: price * 0.6
                    }
                });
            }

            // Sales Invoice (Some Overdue)
            const isUnpaid = Math.random() > 0.4; // 40% unpaid
            const deliveryDate = addDays(orderDate, 4);
            const dueDate = addDays(deliveryDate, customer.creditDays || 30);

            await prisma.salesInvoice.create({
                data: {
                    companyId: company.id,
                    salesOrderId: so.id,
                    invoiceNumber: `INV-${randomBytes(3).toString("hex")}`,
                    status: isUnpaid ? "ISSUED" : "PAID",
                    invoiceDate: deliveryDate,
                    dueDate: dueDate,
                    totalAmount: qty * price,
                    balanceAmount: isUnpaid ? qty * price : 0
                }
            });
        }
    }

    console.log("Full System Seed Complete.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
