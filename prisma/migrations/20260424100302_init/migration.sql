-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "contact_email" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "region" VARCHAR(100) NOT NULL,
    "signup_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_date" TIMESTAMP(6) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "shipped_at" TIMESTAMP(6),
    "delivered_at" TIMESTAMP(6),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_cancellations" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "reason_category" VARCHAR(100) NOT NULL,
    "detailed_reason" TEXT,
    "cancelled_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "order_cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_vendor_id_idx" ON "products"("vendor_id");

-- CreateIndex
CREATE INDEX "orders_order_date_idx" ON "orders"("order_date");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_cancellations_order_id_key" ON "order_cancellations"("order_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_cancellations" ADD CONSTRAINT "order_cancellations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
