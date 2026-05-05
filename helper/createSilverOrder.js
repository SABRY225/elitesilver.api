const { OrderSilver } = require("../models");

const createSilverOrder = async (data, user) => {
  return await OrderSilver.create({
    fullName: data.fullName,
    cityId: data.cityId,
    userId: user ? user.id : null,
    address: data.address,
    phone: data.phone,
    secondaryPhone: data.secondaryPhone,
    paymentMethod: data.paymentMethod,
    quantity: data.quantity,
    total_price: data.total_price,
    productName: data.productName,
    productPrice: data.productPrice,
  });
};

module.exports = createSilverOrder;