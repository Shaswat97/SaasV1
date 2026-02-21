const { PrismaClient } = require("@prisma/client");
const { randomBytes } = require("crypto");

const prisma = new PrismaClient();

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

async function main() {
    console.log("Starting 3-month data seed...");

    const company = await prisma.company.findFirst();
    if (!company) {
        console.error("No company found. Run base seed first.");
        return;
    }

    // Fetch Master Data
    const customers = await prisma.customer.findMany({ where: { companyId: company.id } });
    const skus = await prisma.sku.findMany({ where: { companyId: company.id } });
    const finishedSkus = skus.filter(s => s.type === "FINISHED");
    const rawSkus = skus.filter(s => s.type === "RAW_MATERIAL");
    const machines = await prisma.machine.findMany({ where: { companyId: company.id } });
    const users = await prisma.employee.findMany({ where: { companyId: company.id } });
    const zones = await prisma.zone.findMany({ where: { companyId: company.id }, include: { warehouse: true } });

    const finishedZone = zones.find(z => z.type === "FINISHED");
    const rawZone = zones.find(z => z.type === "RAW_MATERIAL");

    if (!finishedSkus.length || !customers.length) {
        console.log("Not enough master data (SKUs/Customers) to seed transactions.");
        return;
    }

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    const endDate = new Date();

    console.log(`Seeding data from ${startDate.toISOString()} to ${endDate.toISOString()}...`);

    // 1. Generate Sales Orders
    const numOrders = 40;
    for (let i = 0; i < numOrders; i++) {
        const orderDate = randomDate(startDate, endDate);
        const customer = randomItem(customers);
        const status = Math.random() > 0.2 ? "COMPLETED" : "CONFIRMED"; // mostly completed
        const soNumber = `SO-DUMMY-${randomBytes(4).toString("hex").toUpperCase()}`;

        const order = await prisma.salesOrder.create({
            data: {
                companyId: company.id,
                customerId: customer.id,
                soNumber: soNumber,
                status: status,
                orderDate: orderDate,
                currency: "INR",
                notes: "Auto-generated dummy order"
            }
        });

        // Add Lines
        const numLines = randomInt(1, 5);

        for (let j = 0; j < numLines; j++) {
            const sku = randomItem(finishedSkus);
            const qty = randomInt(100, 1000);
            const price = sku.sellingPrice || randomInt(500, 2000);

            const soLine = await prisma.salesOrderLine.create({
                data: {
                    salesOrderId: order.id,
                    skuId: sku.id,
                    quantity: qty,
                    unitPrice: price,
                    discountPct: 0,
                    taxPct: 0,
                    producedQty: status === "COMPLETED" ? qty : 0,
                    deliveredQty: status === "COMPLETED" ? qty : 0,
                    expectedRawCost: 0,
                    actualRawCost: 0
                }
            });

            // If completed, Create Production Log & Inventory Movement
            if (status === "COMPLETED") {
                // 1. Production Log
                const machine = randomItem(machines) || { id: "default", baseCapacityPerMinute: 10 };
                const durationMinutes = (qty / (machine.baseCapacityPerMinute || 10)) * (randomInt(90, 120) / 100); // +/- variance
                const startAt = new Date(orderDate.getTime() + 2 * 24 * 60 * 60 * 1000);
                const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

                if (machines.length > 0) {
                    await prisma.productionLog.create({
                        data: {
                            companyId: company.id,
                            machineId: machine.id,
                            finishedSkuId: sku.id,
                            salesOrderLineId: soLine.id,
                            plannedQty: qty,
                            goodQty: qty,
                            rejectQty: randomInt(0, 5),
                            startAt: startAt,
                            closeAt: endAt,
                            status: "CLOSED",
                            purpose: "ORDER",
                            notes: `Auto-generated for ${soNumber}`,
                            oeePct: randomInt(70, 95)
                        }
                    });
                }

                // 2. Inventory Movement (Production IN)
                if (finishedZone) {
                    await prisma.stockLedger.create({
                        data: {
                            companyId: company.id,
                            zoneId: finishedZone.id,
                            skuId: sku.id,
                            quantity: qty,
                            direction: "IN",
                            movementType: "PRODUCTION_RECEIPT",
                            costPerUnit: price * 0.6, // assume 60% margin
                            totalCost: (price * 0.6) * qty,
                            referenceType: "PRODUCTION_LOG",
                            createdAt: endAt
                        }
                    });
                    // Update Balance
                    const balance = await prisma.stockBalance.findUnique({
                        where: {
                            companyId_skuId_zoneId: {
                                companyId: company.id,
                                zoneId: finishedZone.id,
                                skuId: sku.id
                            }
                        }
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
                                zoneId: finishedZone.id,
                                skuId: sku.id,
                                quantityOnHand: qty,
                                costPerUnit: price * 0.6,
                                totalCost: (price * 0.6) * qty
                            }
                        });
                    }
                }
            }
        }
    }

    // Generate Raw Material Stock
    if (rawZone && rawSkus.length) {
        for (const sku of rawSkus) {
            const qty = randomInt(5000, 50000);
            const cost = randomInt(50, 200);
            await prisma.stockLedger.create({
                data: {
                    companyId: company.id,
                    zoneId: rawZone.id,
                    skuId: sku.id,
                    quantity: qty,
                    direction: "IN",
                    movementType: "PURCHASE_RECEIPT",
                    costPerUnit: cost,
                    totalCost: cost * qty,
                    createdAt: randomDate(startDate, endDate)
                }
            });
            const balance = await prisma.stockBalance.findUnique({
                where: {
                    companyId_skuId_zoneId: {
                        companyId: company.id,
                        zoneId: rawZone.id,
                        skuId: sku.id
                    }
                }
            });
            if (balance) {
                await prisma.stockBalance.update({
                    where: { id: balance.id },
                    data: { quantityOnHand: { increment: qty }, totalCost: { increment: cost * qty } }
                });
            } else {
                await prisma.stockBalance.create({
                    data: {
                        companyId: company.id,
                        zoneId: rawZone.id,
                        skuId: sku.id,
                        quantityOnHand: qty,
                        costPerUnit: cost,
                        totalCost: cost * qty
                    }
                });
            }
        }
    }

    console.log("Seeding complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
