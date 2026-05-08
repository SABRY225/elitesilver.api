const { Product, Category, OrderSilver, User, Order } = require('../models');
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
    const { userId } = req.params;

    // 1. جلب عدد الطلبات من جدول الطلبات العادية
    const ordersCount = await Order.count({
      where: { userId: userId },
    });

    // 2. جلب عدد الطلبات من جدول الفضة (أو الطلبات الأخرى)
    const ordersSilverCount = await OrderSilver.count({
      where: { userId: userId },
    });

    // 3. لحساب النقاط، نحتاج لجلب قيم الطلبات نفسها وليس العدد فقط
    // سنفترض أن النقاط تُحسب من جدول الطلبات الرئيسي (Order)
    const orders = await Order.count({
      where: { userId: userId },
    });

    // حساب مجموع النقاط بناءً على حقل total في الطلبات
    const user = await User.findOne({where: { id: userId }})

    // إرجاع النتيجة النهائية
    return res.status(200).json({ 
      order_count: ordersCount + ordersSilverCount, 
      user_points: user.points 
    });

  } catch (error) {
    console.error("Error in OrderAndPointsByUser:", error);
    return res.status(500).json({ message: 'حدث خطأ أثناء جلب البيانات' });
  }
};

module.exports = {
  getHomeData,
  getInvestmentData,
  OrderAndPointsByUser
};