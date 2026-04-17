const { Product, Category } = require('../models');
const { getInvestment } = require('../utils/getInvestment');

const getHomeData = async (req, res) => {
  try {
    // 1️⃣ Categories
    const categories = await Category.findAll({
      attributes: [
        'name',
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


module.exports = {
  getHomeData
};