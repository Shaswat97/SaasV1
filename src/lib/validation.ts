import { z } from "zod";

const addressSchema = z.object({
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required")
});

const optionalAddressSchema = addressSchema.partial();

export const roleNameSchema = z.enum(["ADMIN"]);

export const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  gstin: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
  rawValuationMethod: z.string().optional(),
  finishedValuationMethod: z.string().optional(),
  wipValuationMethod: z.string().optional(),
  billingAddress: optionalAddressSchema.optional(),
  shippingAddress: optionalAddressSchema.optional()
});

export const employeeSchema = z.object({
  code: z.string().min(1, "Employee code is required"),
  name: z.string().min(1, "Employee name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
  active: z.boolean().optional(),
  roles: z.array(roleNameSchema).min(1, "At least one role is required")
});

export const vendorSchema = z.object({
  code: z.string().min(1, "Vendor code is required"),
  name: z.string().min(1, "Vendor name is required"),
  vendorType: z.enum(["RAW", "SUBCONTRACT"]).optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
  gstin: z.string().optional(),
  active: z.boolean().optional(),
  billingAddress: optionalAddressSchema.optional(),
  shippingAddress: optionalAddressSchema.optional()
});

export const customerSchema = z.object({
  code: z.string().min(1, "Customer code is required"),
  name: z.string().min(1, "Customer name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
  gstin: z.string().optional(),
  active: z.boolean().optional(),
  billingAddress: optionalAddressSchema.optional(),
  shippingAddress: optionalAddressSchema.optional()
});

export const skuSchema = z.object({
  code: z.string().min(1, "SKU code is required"),
  name: z.string().min(1, "SKU name is required"),
  unit: z.string().min(1, "Unit is required"),
  scrapPct: z.number().min(0).max(100).optional(),
  preferredVendorId: z.string().min(1).nullable().optional(),
  lastPurchasePrice: z.number().nonnegative().optional(),
  standardCost: z.number().nonnegative().optional(),
  manufacturingCost: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
  lowStockThreshold: z.number().nonnegative().optional(),
  active: z.boolean().optional()
});

export const machineSchema = z.object({
  code: z.string().min(1, "Machine code is required"),
  name: z.string().min(1, "Machine name is required"),
  model: z.string().optional(),
  category: z.string().optional(),
  baseCapacityPerMinute: z.number().positive("Base capacity per minute must be positive"),
  active: z.boolean().optional()
});

export const machineSkuSchema = z.object({
  machineId: z.string().min(1, "Machine is required"),
  skuId: z.string().min(1, "Finished SKU is required"),
  capacityPerMinute: z.number().positive("Capacity per minute must be positive"),
  active: z.boolean().optional()
});

export const bomLineSchema = z.object({
  rawSkuId: z.string().min(1, "Raw SKU is required"),
  quantity: z.number().positive("Quantity must be positive"),
  scrapPct: z.number().min(0).max(100).optional()
});

export const bomSchema = z.object({
  finishedSkuId: z.string().min(1, "Finished SKU is required"),
  version: z.number().int().positive().optional(),
  name: z.string().optional(),
  active: z.boolean().optional(),
  lines: z.array(bomLineSchema).min(1, "At least one BOM line is required")
});

export const warehouseSchema = z.object({
  code: z.string().min(1, "Warehouse code is required"),
  name: z.string().min(1, "Warehouse name is required"),
  active: z.boolean().optional()
});

export const zoneSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  code: z.string().min(1, "Zone code is required"),
  name: z.string().min(1, "Zone name is required"),
  type: z.enum(["RAW_MATERIAL", "PROCESSING_WIP", "FINISHED", "SCRAP", "IN_TRANSIT", "OTHER"]),
  active: z.boolean().optional()
});
