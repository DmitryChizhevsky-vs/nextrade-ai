/**
 * Seed script — creates two vendors with realistic but distinct
 * product catalogues and ~90 days of orders each. Used to demo
 * data isolation (Supplier 1 must never see Supplier 2's numbers).
 *
 * Run: npm run db:seed
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ------------------------------------------------------------------
// Deterministic PRNG so seeds are reproducible across runs.
// ------------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);
const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
const between = (min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min;

// ------------------------------------------------------------------
// Static reference data
// ------------------------------------------------------------------
const REGIONS = ["North America", "EMEA", "APAC", "LATAM"];

const CANCEL_REASONS = [
  "customer_request",
  "payment_failed",
  "out_of_stock",
  "shipping_delay",
  "address_issue",
];

const VENDOR_A_PRODUCTS = [
  { sku: "APX-001", name: "Alpine Peak Running Shoes",   category: "Footwear",     unit_price: 129.0 },
  { sku: "APX-002", name: "Trailblazer Hiking Boots",    category: "Footwear",     unit_price: 189.0 },
  { sku: "APX-003", name: "Urban Flex Sneakers",         category: "Footwear",     unit_price: 99.0  },
  { sku: "APX-010", name: "ThermaCore Winter Jacket",    category: "Outerwear",    unit_price: 249.0 },
  { sku: "APX-011", name: "Stormshell Rain Parka",       category: "Outerwear",    unit_price: 179.0 },
  { sku: "APX-020", name: "Pro-Dry Performance Tee",     category: "Tops",         unit_price: 39.0  },
  { sku: "APX-021", name: "Merino Base Layer",           category: "Tops",         unit_price: 69.0  },
  { sku: "APX-030", name: "FlexFit Training Shorts",     category: "Bottoms",      unit_price: 49.0  },
  { sku: "APX-031", name: "Summit Trek Pants",           category: "Bottoms",      unit_price: 89.0  },
  { sku: "APX-040", name: "Atlas Trail Backpack 30L",    category: "Accessories",  unit_price: 119.0 },
];

const VENDOR_B_PRODUCTS = [
  { sku: "NBA-001", name: "NovaBrew Espresso Machine",    category: "Appliances",    unit_price: 449.0 },
  { sku: "NBA-002", name: "PourCraft Kettle",             category: "Appliances",    unit_price: 89.0  },
  { sku: "NBA-003", name: "GrindPro Coffee Grinder",      category: "Appliances",    unit_price: 159.0 },
  { sku: "NBA-010", name: "Artisan Ceramic Mug Set (4)",  category: "Drinkware",     unit_price: 49.0  },
  { sku: "NBA-011", name: "Double-Wall Glass Tumbler",    category: "Drinkware",     unit_price: 24.0  },
  { sku: "NBA-012", name: "Traveller Thermal Flask",      category: "Drinkware",     unit_price: 34.0  },
  { sku: "NBA-020", name: "Single-Origin Beans 250g",     category: "Consumables",   unit_price: 18.0  },
  { sku: "NBA-021", name: "Classic Blend Beans 1kg",      category: "Consumables",   unit_price: 42.0  },
  { sku: "NBA-030", name: "Precision Pour-Over Dripper",  category: "Barista Tools", unit_price: 29.0  },
  { sku: "NBA-031", name: "Milk Frothing Pitcher 600ml",  category: "Barista Tools", unit_price: 22.0  },
];

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  console.log("🧹 Clearing existing data...");
  await prisma.orderCancellation.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.vendor.deleteMany();

  console.log("🏢 Creating vendors...");
  const vendorA = await prisma.vendor.create({
    data: {
      company_name: "Apex Outdoor Co.",
      contact_email: "ops@apexoutdoor.example",
      status: "active",
    },
  });
  const vendorB = await prisma.vendor.create({
    data: {
      company_name: "NovaBrew Coffee",
      contact_email: "hello@novabrew.example",
      status: "active",
    },
  });

  console.log("📦 Creating products...");
  const productsA = await Promise.all(
    VENDOR_A_PRODUCTS.map((p) =>
      prisma.product.create({ data: { ...p, vendor_id: vendorA.id } })
    )
  );
  const productsB = await Promise.all(
    VENDOR_B_PRODUCTS.map((p) =>
      prisma.product.create({ data: { ...p, vendor_id: vendorB.id } })
    )
  );

  console.log("👥 Creating customers...");
  const customers = await Promise.all(
    Array.from({ length: 60 }).map((_, i) =>
      prisma.customer.create({
        data: {
          email: `customer${i + 1}@example.com`,
          region: pick(REGIONS),
          signup_date: daysAgo(between(30, 400)),
        },
      })
    )
  );

  console.log("🧾 Creating orders for each vendor...");
  await seedOrders(vendorA.id, productsA, customers, 320); // Vendor A: busier
  await seedOrders(vendorB.id, productsB, customers, 180); // Vendor B: smaller

  const [vA, vB] = await Promise.all([
    prisma.order.count({ where: { items: { some: { product: { vendor_id: vendorA.id } } } } }),
    prisma.order.count({ where: { items: { some: { product: { vendor_id: vendorB.id } } } } }),
  ]);

  console.log(`✅ Seed complete: Apex Outdoor=${vA} orders, NovaBrew=${vB} orders`);
  console.log(`   Vendor A id: ${vendorA.id}`);
  console.log(`   Vendor B id: ${vendorB.id}`);
}

async function seedOrders(
  vendorId: string,
  products: { id: string; unit_price: Prisma.Decimal }[],
  customers: { id: string }[],
  orderCount: number
) {
  for (let i = 0; i < orderCount; i++) {
    const customer = pick(customers);
    const orderDate = daysAgo(between(0, 90));
    const itemCount = between(1, 4);

    // Pick distinct products
    const chosen: typeof products = [];
    while (chosen.length < itemCount) {
      const p = pick(products);
      if (!chosen.find((c) => c.id === p.id)) chosen.push(p);
    }

    const items = chosen.map((p) => ({
      product_id: p.id,
      quantity: between(1, 5),
      unit_price: p.unit_price,
    }));

    const total = items.reduce(
      (acc, it) => acc + Number(it.unit_price) * it.quantity,
      0
    );

    // 12% chance the order was cancelled; otherwise shipped/delivered
    const roll = rng();
    let status: string;
    let shipped_at: Date | null = null;
    let delivered_at: Date | null = null;
    let cancel: { category: string; detailed_reason: string | null; cancelled_at: Date } | null = null;

    if (roll < 0.12) {
      status = "cancelled";
      cancel = {
        category: pick(CANCEL_REASONS),
        // Intentionally sparse: ~70% of cancellations have no free-text reason.
        // This is what Dave warned about on the kickoff call — the AI must
        // not hallucinate reasons when this column is empty.
        detailed_reason: rng() < 0.3 ? "Customer called support and requested cancellation." : null,
        cancelled_at: addHours(orderDate, between(1, 48)),
      };
    } else if (roll < 0.75) {
      status = "delivered";
      shipped_at = addHours(orderDate, between(12, 48));
      delivered_at = addHours(shipped_at, between(24, 120));
    } else {
      status = "shipped";
      shipped_at = addHours(orderDate, between(12, 48));
    }

    await prisma.order.create({
      data: {
        customer_id: customer.id,
        order_date: orderDate,
        status,
        total_amount: total.toFixed(2),
        shipped_at,
        delivered_at,
        items: { create: items },
        cancellation: cancel
          ? {
              create: {
                reason_category: cancel.category,
                detailed_reason: cancel.detailed_reason,
                cancelled_at: cancel.cancelled_at,
              },
            }
          : undefined,
      },
    });
  }
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(between(8, 20), between(0, 59), 0, 0);
  return d;
}
function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600 * 1000);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
