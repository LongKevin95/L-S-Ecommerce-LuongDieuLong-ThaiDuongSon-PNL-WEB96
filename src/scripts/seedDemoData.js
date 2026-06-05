import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { connectDatabase } from "../config/db.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Shop from "../models/Shop.js";
import { USER_ROLES } from "../constants/roles.js";
import { USER_STATUS } from "../constants/userStatus.js";
import { PRODUCT_STATUS } from "../constants/productStatus.js";
import { ORDER_STATUS, PAYMENT_METHODS } from "../constants/orderStatus.js";
import { slugify } from "../utils/slugify.js";
import {
  buildUserShopSnapshot,
  resolvePreferredShopObjectId,
} from "../utils/shop.js";

const DEMO_SHOP = {
  name: "Vendor Demo Shop",
  slug: slugify("Vendor Demo Shop"),
};

const DEMO_PRODUCT_DEFINITIONS = [
  {
    title: "Gaming Headphone",
    slug: slugify("Gaming Headphone"),
    category: "electronics",
    description: "Comfortable headphone for daily gaming.",
    price: 120,
    oldPrice: 150,
    stock: 8,
    thumbnail:
      "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=900&q=80",
    ],
    status: PRODUCT_STATUS.ACTIVE,
  },
  {
    title: "Desk Lamp Minimal",
    slug: slugify("Desk Lamp Minimal"),
    category: "home",
    description: "Draft product used for vendor/admin management demo.",
    price: 45,
    oldPrice: 59,
    stock: 4,
    thumbnail:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    ],
    status: PRODUCT_STATUS.DRAFT,
  },
  {
    title: "Mechanical Keyboard Compact",
    slug: slugify("Mechanical Keyboard Compact"),
    category: "electronics",
    description: "Pending review product for admin moderation flow.",
    price: 80,
    oldPrice: 99,
    stock: 10,
    thumbnail:
      "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=900&q=80",
    ],
    status: PRODUCT_STATUS.PENDING,
  },
];

function buildStableShop(existingUser, shop) {
  if (!shop) {
    return existingUser?.shop ?? null;
  }

  return {
    id:
      existingUser?.shop?.id ||
      shop.id ||
      new mongoose.Types.ObjectId().toString(),
    name: shop.name,
    slug: shop.slug,
  };
}

async function upsertUser({ name, email, password, roles, status, shop }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const existingUser = await User.findOne({ email });

  const user = await User.findOneAndUpdate(
    { email },
    {
      name,
      email,
      password: hashedPassword,
      roles,
      status,
      shop: buildStableShop(existingUser, shop),
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return user;
}

async function upsertShop(owner, shop) {
  if (!shop) {
    return null;
  }

  const existingShop = await Shop.findOne({ ownerId: owner.id });

  if (existingShop) {
    existingShop.name = shop.name;
    existingShop.slug = shop.slug;
    existingShop.contactEmail = owner.email;
    existingShop.phone = owner.phone || existingShop.phone || "";
    await existingShop.save();
    return existingShop;
  }

  const preferredObjectId = resolvePreferredShopObjectId(owner?.shop?.id);

  return Shop.create({
    ...(preferredObjectId ? { _id: preferredObjectId } : {}),
    name: shop.name,
    slug: shop.slug,
    ownerId: owner.id,
    contactEmail: owner.email,
    phone: owner.phone || "",
  });
}

async function resetVendorProducts(vendor, shop) {
  const products = await Promise.all(
    DEMO_PRODUCT_DEFINITIONS.map((productDefinition) =>
      Product.findOneAndUpdate(
        {
          vendorId: vendor.id,
          slug: productDefinition.slug,
        },
        {
          ...productDefinition,
          vendorId: vendor.id,
          shopId: shop?.id ?? "",
          shopName: shop?.name ?? "",
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      ),
    ),
  );

  await Product.deleteMany({
    vendorId: vendor.id,
    slug: {
      $nin: DEMO_PRODUCT_DEFINITIONS.map((product) => product.slug),
    },
  });

  return products;
}

async function resetOrders(customer, products) {
  await Order.deleteMany({ customerId: customer.id });

  const activeProduct = products.find(
    (product) => product.status === PRODUCT_STATUS.ACTIVE,
  );
  const pendingProduct = products.find(
    (product) => product.status === PRODUCT_STATUS.PENDING,
  );

  if (!activeProduct || !pendingProduct) {
    return [];
  }

  return Order.create([
    {
      customerId: customer.id,
      status: ORDER_STATUS.PENDING,
      paymentMethod: PAYMENT_METHODS.COD,
      shippingAddress: {
        fullName: customer.name,
        phone: customer.phone || "0900000002",
        address: customer.address || "District 1",
        city: "HCM City",
        state: "HCM",
        zipCode: "700000",
        country: "Vietnam",
      },
      items: [
        {
          productId: activeProduct.id,
          quantity: 1,
          color: "Black",
          size: "Default",
        },
      ],
      total: activeProduct.price,
    },
    {
      customerId: customer.id,
      status: ORDER_STATUS.PROCESSING,
      paymentMethod: PAYMENT_METHODS.CARD,
      shippingAddress: {
        fullName: customer.name,
        phone: customer.phone || "0900000002",
        address: customer.address || "District 1",
        city: "HCM City",
        state: "HCM",
        zipCode: "700000",
        country: "Vietnam",
      },
      items: [
        {
          productId: pendingProduct.id,
          quantity: 1,
          color: "Gray",
          size: "Default",
        },
      ],
      total: pendingProduct.price,
    },
  ]);
}

async function main() {
  await connectDatabase();

  await upsertUser({
    name: "Admin Demo",
    email: "admin@ls.com",
    password: "123456",
    roles: [USER_ROLES.ADMIN],
    status: USER_STATUS.ACTIVE,
  });

  const vendor = await upsertUser({
    name: "Vendor Demo",
    email: "vendor@ls.com",
    password: "123456",
    roles: [USER_ROLES.VENDOR],
    status: USER_STATUS.ACTIVE,
    shop: DEMO_SHOP,
  });

  const vendorShop = await upsertShop(vendor, DEMO_SHOP);
  vendor.shop = buildUserShopSnapshot(vendorShop);
  await vendor.save();

  const customer = await upsertUser({
    name: "Long Customer",
    email: "customer@ls.com",
    password: "123456",
    roles: [USER_ROLES.CUSTOMER],
    status: USER_STATUS.ACTIVE,
  });

  customer.phone = customer.phone || "0900000002";
  customer.address = customer.address || "District 1";
  await customer.save();

  const products = await resetVendorProducts(vendor, vendorShop);
  await resetOrders(customer, products);

  console.info("Demo data seeded successfully.");
  console.info("Accounts:");
  console.info("- customer@ls.com / 123456");
  console.info("- vendor@ls.com / 123456");
  console.info("- admin@ls.com / 123456");

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error("Failed to seed demo data.", error);
  await mongoose.connection.close();
  process.exit(1);
});
