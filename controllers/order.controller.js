const { Order, Product } = require('../models');

// إنشاء طلب منتج جاهز
exports.createOrder = async (req, res) => {
  try {
    const { productId, quantity, customerName, phone, address, notes } = req.body;
    const product = await Product.findByPk(productId);
    
    const totalPrice = product.price * quantity;
    const order = await Order.create({
      productId, quantity, customerName, phone, address, notes, totalPrice
    });
    
    res.status(201).json({ message: "تم استقبال طلبك بنجاح", order });
  } catch (error) {
    res.status(400).json({ message: "فشل في إنشاء الطلب" ,error:error.message});
  }
};

// جلب كل الطلبات للمدير
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      // نحدد الموديل المرتبط 'Product' 
      // تأكد أن الاسم يطابق التعريف في models/index.js
      include: [{
        association: 'product', 
        attributes: ['name', 'image'] // جلب الاسم والصورة فقط
      }],
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: "خطأ في جلب الطلبات", error: error.message });
  }
};
exports.updateStatus = async (req, res) => { 
  const { id } = req.params;
  const { status } = req.body;
  const order = await Order.findByPk(id);
  if (!order) return res.status(404).json({ message: "الطلب غير موجود" });
  order.status = status;
  await order.save();
  res.json({ message: "تم تحديث حالة الطلب", order });
}