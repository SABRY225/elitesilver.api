const { Product } = require("../models");

const updateProductStock = async (cartItems) => {
  for (const item of cartItems) {
    const product = await Product.findByPk(item.productId);

    if (product) {
      product.quantity -= item.quantity;
      await product.save();
    }
  }
};

module.exports = updateProductStock;
