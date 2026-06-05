export function attachVendorItemsToOrder(order, vendorProductIdSet) {
  const plainOrder = typeof order.toJSON === "function" ? order.toJSON() : { ...order };

  return {
    ...plainOrder,
    vendorItems: Array.isArray(plainOrder.items)
      ? plainOrder.items.filter((item) => vendorProductIdSet.has(String(item.productId)))
      : [],
  };
}
