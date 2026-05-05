const { Op } = require("sequelize");
const {
  Order,
  Product,
  OrderCashierSystem,
  OrderItemCashier,
  User,
  City,
  OrderSilver,
  sequelize,
} = require("../models");
const sendEmailNotification = require("../utils/sendEmail");

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
    } else {
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
      const emailToUse = user ? user.email : req.body.email; // استخدم إيميل المستخدم أو الإيميل المدخل في الفورم
      if (emailToUse) {
        const html = `<h2>شكراً لطلبك!</h2><p>تم استلام طلبك بقيمة ${total} دينار وجاري معالجته الآن.</p>`;
        sendEmailNotification(emailToUse, "تأكيد استلام الطلب", html).catch(
          console.error,
        );
      }
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
    } else {
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
      const emailToUse = user ? user.email : req.body.email; // استخدم إيميل المستخدم أو الإيميل المدخل في الفورم
      if (emailToUse) {
        const html = `<h2>شكراً لطلبك!</h2><p>تم استلام طلبك بقيمة ${(total_price).toFixed(2)} دينار وجاري معالجته الآن.</p>`;
        sendEmailNotification(emailToUse, "تأكيد استلام الطلب", html).catch(
          console.error,
        );
      }
      return res.status(201).json({ message: "تم استقبال طلبك بنجاح", order });
    }
  } catch (error) {
    res
      .status(400)
      .json({ message: "فشل في إنشاء الطلب", error: error.message });
  }
};
exports.getOrdersSilver = async (req, res) => {
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
};

exports.getOrdersSilver = async (req, res) => {
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
};
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
    return res.status(200).json(orders);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "خطأ في جلب الطلبات", error: error.message });
  }
};
exports.getOrdersMobileByUser = async (req, res) => {
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
    return res.status(200).json({ orders });
  } catch (error) {
    return res
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
exports.getDashboardStats = async (req, res) => {
  try {
    // تحديد بداية اليوم (00:00:00)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // 1. جلب الإحصائيات (العدد)
    const buyCount = await OrderCashierSystem.count({
      where: { orderType: "buy", createdAt: { [Op.gte]: startOfDay } },
    });
    const sellCount = await OrderCashierSystem.count({
      where: { orderType: "sell", createdAt: { [Op.gte]: startOfDay } },
    });
    const repairCount = await OrderCashierSystem.count({
      where: { orderType: "repair", createdAt: { [Op.gte]: startOfDay } },
    });

    // 2. جلب عدد العملاء الجدد اليوم
    const newCustomers = await User.count({
      where: {
        createdAt: { [Op.gte]: startOfDay },
      },
    });

    // 3. جلب آخر النشاطات (مصفوفة للـ Slider)
    // نجلب آخر 10 عمليات مع بيانات العميل المرتبط بها
    const recentActivities = await OrderCashierSystem.findAll({
      limit: 10,
      order: [["createdAt", "DESC"]],
      include: [{ model: User, as: "user", attributes: ["name"] }],
      where: {
        createdAt: { [Op.gte]: startOfDay },
      },
    });

    // تنسيق البيانات لتناسب الـ ActivitySlider في الفرونت إند
    const formattedActivities = recentActivities.map((order) => ({
      type: order.orderType,
      total: order.totalAmount,
      customerName: order.user ? order.user.name : "عميل نقدي",
      time: order.createdAt, // يمكنك استخدام مكتبة moment أو date-fns لتنسيق الوقت
    }));

    res.status(200).json({
      stats: {
        buyCount,
        sellCount,
        repairCount,
        newCustomers,
      },
      recentActivities: formattedActivities,
    });
  } catch (error) {
    res.status(500).json({
      message: "خطأ في جلب بيانات لوحة التحكم",
      error: error.message,
    });
  }
};
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "الطلب غير موجود" });
    order.status = status;
    await order.save();
    if (order.User && order.User.email) {
      const html = `<h2>تحديث حالة الطلب #${order.id}</h2><p>عزيزي العميل، تم تغيير حالة طلبك إلى: <b>${status}</b></p>`;
      sendEmailNotification(order.User.email, "تحديث حالة الطلب", html).catch(
        console.error,
      );
    }
    return res.json({ message: "تم تحديث حالة الطلب", order });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateStatusOrderSilver = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const order = await OrderSilver.findByPk(id);
    if (!order) return res.status(404).json({ message: "الطلب غير موجود" });
    order.status = status;
    await order.save();
    if (order.User && order.User.email) {
      const html = `<h2>تحديث حالة طلب الفضة #${order.id}</h2><p>تم تغيير الحالة إلى: <b>${status}</b></p>`;
      sendEmailNotification(
        order.User.email,
        "تحديث حالة طلب الفضة",
        html,
      ).catch(console.error);
    }
    res.json({ message: "تم تحديث حالة الطلب", order });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createOrderCashierSystem = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { customerId, items, totalAmount, paymentMethod, orderType } = req.body;

    const customer = await User.findByPk(customerId, { transaction: t });
    if (!customer) {
      throw new Error("العميل غير موجود");
    }

    if (paymentMethod === "points") {
      const pointsInMoney = Number(customer.points) * 0.05;

      if (pointsInMoney < Number(totalAmount)) {
        await t.rollback();
        return res.status(400).json({
          message: `رصيد النقاط غير كافٍ. القيمة الحالية لنقاطك هي ${pointsInMoney.toFixed(2)} دينار`,
        });
      }

      const pointsToDeduct = Number(totalAmount) * 20;
      await customer.decrement("points", {
        by: pointsToDeduct,
        transaction: t,
      });

      if (customer.email) {
        const html = `<h3>تم استخدام نقاطك للدفع</h3><p>تم خصم ${pointsToDeduct} نقطة مقابل مشتريات بقيمة ${totalAmount} دينار.</p>`;
        sendEmailNotification(customer.email, "إيصال دفع بالنقاط", html).catch(console.error);
      }
    } else {
      await customer.increment("points", {
        by: Math.floor(Number(totalAmount)),
        transaction: t,
      });
    }

    const order = await OrderCashierSystem.create(
      {
        userId: customerId,
        totalAmount,
        paymentMethod,
        orderType,
      },
      { transaction: t }
    );

    const orderItems = items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      orderCashierSystemId: order.id,
      subTotal: Number(item.unitPrice) * Number(item.quantity),
    }));

    await OrderItemCashier.bulkCreate(orderItems, { transaction: t });

    await t.commit();

    res.status(201).json({
      message: "تم حفظ الفاتورة بنجاح",
      orderId: order.id,
      newPointsBalance: customer.points,
    });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

exports.getFilteredOrders = async (req, res) => {
  try {
    const { date, type } = req.query;

    // بناء كائن الشروط (Where Clause)
    let whereClause = {};

    // 1. فلترة حسب التاريخ (إذا أرسل العميل تاريخاً)
    if (date) {
      whereClause.createdAt = {
        [Op.gte]: new Date(date + "T00:00:00.000Z"), // من بداية اليوم
        [Op.lte]: new Date(date + "T23:59:59.999Z"), // حتى نهاية اليوم
      };
    }

    // 2. فلترة حسب نوع الطلب (صيانة، بيع، شراء)
    // إذا كانت القيمة 'all' لا نضيف شرطاً لنوع الطلب
    if (type && type !== "all") {
      whereClause.orderType = type;
    }

    // جلب البيانات من قاعدة البيانات
    const orders = await OrderCashierSystem.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "user", // تأكد أن هذا الاسم يطابق الـ Alias في الموديل
          attributes: ["name", "phone"], // نجلب الاسم والهاتف فقط للسرعة
        },
      ],
      order: [["createdAt", "DESC"]], // عرض الأحدث أولاً
    });

    res.status(200).json(orders);
  } catch (error) {
    console.error("Filter Error:", error);
    res.status(500).json({
      message: "خطأ في استرجاع البيانات المفلترة",
      error: error.message,
    });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await OrderCashierSystem.findByPk(id, {
      include: [
        { model: User, as: "user", attributes: ["name", "phone", "address"] },
        { model: OrderItemCashier, as: "items" }, // تأكد أن الـ Alias صحيح
      ],
    });

    if (!order) {
      return res.status(404).json({ message: "الطلب غير موجود" });
    }

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
