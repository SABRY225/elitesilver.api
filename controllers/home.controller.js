const { Product, Category } = require('../models');
const { getInvestment } = require('../utils/getInvestment');

const getHomeData = async (req, res) => {
  try {
    // 1️⃣ Categories
    const categories = await Category.findAll({
      attributes: [
        'name','id',
        ['image', 'image_url']
      ]
    });

    // 2️⃣ Products (مثلاً غير استثماري)
    const products = await Product.findAll({
      attributes: ['id','name', 'price', 'image'],
      limit: 4
    });

    // 3️⃣ Investment (فلترة مختلفة)
    const investment = await getInvestment();

    res.json({
      categories,
      products,
      investment
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Server Error'
    });
  }
};
const getInvestmentData = async (req, res) => {
  try {
    const investment = await getInvestment();
    return res.status(200).json(investment);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Server Error'
    });
  }
};

const OrderAndPointsByUser = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { userId: req.params.userId },
      attributes: ['id', 'total', 'createdAt']
    });
    const totalPoints = orders.reduce((sum, order) => sum + order.total, 0);
    return { orders, totalPoints };
  } catch (error) {
    console.error(error);
    throw new Error('Error while fetching order and points data');
  }
};

module.exports = {
  getHomeData,
  getInvestmentData,
  OrderAndPointsByUser
};