const { Order, Product, User, City ,OrderSilver} = require("../models");

// إنشاء طلب منتج جاهز
exports.createOrder = async (req, res) => {
  try {
    const {
      fullName,
      city: cityId,
      address,
      phone,
      alternatePhone,
      paymentMethod,
      cartItems,
      subtotal,
      shipping,
      total,
      userId,
      notes,
    } = req.body;

    // التحقق من وجود المستخدم
    const user = await User.findByPk(userId);
    if (!user) {
      const cityData = await City.findByPk(cityId);
      if (!cityData)
        return res.status(404).json({ message: "المدينة غير موجودة" });

      const order = await Order.create({
        fullName,
        cityId,
        address,
        phone,
        alternatePhone,
        paymentMethod,
        cartItems,
        subtotal,
        shipping,
        total,
        notes,
      });
      return res.status(201).json({ message: "تم استقبال طلبك بنجاح", order });
    }else{
       // التحقق من وجود المدينة
    const cityData = await City.findByPk(cityId);
    if (!cityData)
      return res.status(404).json({ message: "المدينة غير موجودة" });

    const order = await Order.create({
      fullName,
      cityId,
      address,
      phone,
      alternatePhone,
      paymentMethod,
      cartItems,
      subtotal,
      shipping,
      total,
      userId,
      notes,
    });

    return res.status(201).json({ message: "تم استقبال طلبك بنجاح", order });
    }
  } catch (error) {
    res
      .status(400)
      .json({ message: "فشل في إنشاء الطلب", error: error.message });
  }
};

exports.createOrderSilver = async (req, res) => {
  try {
    const {
      fullName,
      cityId,
      address,
      phone,
      secondaryPhone,
      paymentMethod,
      productName,
      productPrice,
      quantity,
      total_price,
      userId,
    } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      const cityData = await City.findByPk(cityId);
      if (!cityData)
        return res.status(404).json({ message: "المدينة غير موجودة" });

      const order = await OrderSilver.create({
        fullName,
        cityId,
        address,
        phone,
        secondaryPhone,
        paymentMethod,
        quantity,
        total_price,
        productName,
        productPrice,
      });
      return res.status(201).json({ message: "تم استقبال طلبك بنجاح", order });
    }else{
       const cityData = await City.findByPk(cityId);
    if (!cityData)
      return res.status(404).json({ message: "المدينة غير موجودة" });

    const order = await OrderSilver.create({
        fullName,
        cityId,
        userId,
        address,
        phone,
        secondaryPhone,
        paymentMethod,
        quantity,
        total_price,
        productName,
        productPrice,
    });

    return res.status(201).json({ message: "تم استقبال طلبك بنجاح", order });
    }
  } catch (error) {
    res
      .status(400)
      .json({ message: "فشل في إنشاء الطلب", error: error.message });
  }
};
exports.getOrdersSilver= async (req, res) => {
  try {
    const orders = await OrderSilver.findAll({
      include: [
        {
          association: "user",
          attributes: ["name", "email"],
        },
        {
          association: "cityInfo",
          attributes: ["name", "price"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "خطأ في جلب الطلبات", error: error.message });
  }
}

exports.getOrdersSilver= async (req, res) => {
  try {
    const orders = await OrderSilver.findAll({
      include: [
        {
          association: "user",
          attributes: ["name", "email"],
        },
        {
          association: "cityInfo",
          attributes: ["name", "price"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "خطأ في جلب الطلبات", error: error.message });
  }
}
exports.getOrdersSilverByUser = async (req, res) => {
  const { userId } = req.params;
  try { 
    const orders = await OrderSilver.findAll({
      where: { userId },
      include: [
        {
          association: "cityInfo",
          attributes: ["name", "price"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "خطأ في جلب الطلبات", error: error.message });
  }
};

exports.getOrdersByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const orders = await Order.findAll({
      where: { userId },
      include: [
        {
          association: "cityInfo",
          attributes: ["name", "price"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "خطأ في جلب الطلبات", error: error.message });
  }
};

// جلب كل الطلبات للمدير
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [
        {
          association: "user",
          attributes: ["name", "email"],
        },
        {
          association: "cityInfo",
          attributes: ["name", "price"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "خطأ في جلب الطلبات", error: error.message });
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
};

exports.updateStatusOrderSilver = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const order = await OrderSilver.findByPk(id);
  if (!order) return res.status(404).json({ message: "الطلب غير موجود" });
  order.status = status;
  await order.save();
  res.json({ message: "تم تحديث حالة الطلب", order });
};
