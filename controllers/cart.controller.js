// controllers/cartController.js
const { Cart, Product } = require('../models');

exports.getCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const items = await Cart.findAll({
      where: { userId },
      include: [ Product]
    })
    
    const formattedCart = items.map(item => ({
      id: item.productId,
      name: item.Product.name,
      price: item.Product.price,
      image: item.Product.image,
      qty: item.qty
    }));

    res.json(formattedCart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.syncCart = async (req, res) => {
  try {
    const { userId, items } = req.body; 

    await Cart.destroy({ where: { userId } });

    if (items && items.length > 0) {
      const cartData = items.map(item => ({
        userId: userId,
        productId: item.id,
        qty: item.qty
      }));
      await Cart.bulkCreate(cartData);
    }

    res.json({ message: "تمت مزامنة السلة بنجاح" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};