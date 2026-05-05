const { Order } = require("../models");

const createOrderRecord = async (data, user) => {
  return await Order.create({
    fullName: data.fullName,
    cityId: data.city,
    address: data.address,
    phone: data.phone,
    alternatePhone: data.alternatePhone,
    paymentMethod: data.paymentMethod,
    cartItems: data.cartItems,
    subtotal: data.subtotal,
    shipping: data.shipping,
    total: data.total,
    userId: user ? user.id : null,
    notes: data.notes,
  });
};
module.exports = createOrderRecord;