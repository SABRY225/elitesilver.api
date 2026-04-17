const { Commission } = require("../models");

// جلب العمولات وتحويلها لتنسيق كائن (Object) للفرونت أند
exports.getAllCommissions = async (req, res) => {
  try {
    const commissions = await Commission.findAll();
    
    const formattedData = {};
    commissions.forEach(item => {
      formattedData[item.key] = item.value;
    });

    res.status(200).json({
      status: 'success',
      data: formattedData
    });
  } catch (error) {
    res.status(500).json({ status: 'error ---', message: error.message });
  }
};

// تحديث العمولات (Update or Create)
exports.updateCommissions = async (req, res) => {
  try {
    const { commissions } = req.body; // يتوقع كائن من الفرونت أند { uae_kilo: 7, ... }

    // استخدام Loop لتحديث كل مفتاح على حدة
    const updatePromises = Object.entries(commissions).map(([key, value]) => {
      return Commission.upsert({ key, value }); // تحديث إذا وجد أو إنشاء إذا لم يوجد
    });

    await Promise.all(updatePromises);

    res.status(200).json({
      status: 'success',
      message: 'تم تحديث العمولات بنجاح'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};