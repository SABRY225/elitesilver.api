const axios = require('axios');
const { Commission } = require('../models');

const JOD_EXCHANGE_RATE = 0.7080;

const getInvestment = async () => {
  try {
    // 🟢 1. نجيب سعر الفضة
    const response = await axios.get(
      'https://api.gold-api.com/price/XAG/USD',
      { timeout: 5000 } // مهم جدًا
    );

    const silverPrice = response.data?.price;

    if (!silverPrice) {
      throw new Error('Invalid API response');
    }

    // 🟢 2. نجيب commissions مرة واحدة بس
    const commissions = await Commission.findAll();

    if (!commissions.length) {
      throw new Error('No commissions found');
    }

    // 🟢 3. المنتجات
    const items = [
      { id: 'uae_kilo', image: '/uploads/investment/uae_kilo.png', name: 'كيلو فضة إماراتي 999' },
      { id: 'swiss_kilo', image: '/uploads/investment/swiss_kilo.png', name: 'كيلو فضة سويسري' },
      { id: 'ounce_31', image: '/uploads/investment/ounce_31.png', name: 'أونصة 31.1 جرام' },
      { id: 'ounce_100', image: '/uploads/investment/ounce_100.png', name: 'سبيكة فضة 100 جرام' },
      { id: 'lira_5', image: '/uploads/investment/lira_5.png', name: 'ليرة فضة فنية 5 جرام' }
    ];

    // 🟢 4. الحساب
    const result = items.map(item => ({
      id: item.id,
      image: item.image,
      name: item.name,
      price: calculatePrice(item.id, silverPrice, commissions).toFixed(2)
    }));

    return result;

  } catch (error) {
    console.error('Investment Error:', error.message);

    // 🔴 fallback (مهم جدًا)
    return [
      {
        id: 'error',
        name: 'تعذر تحميل الأسعار حالياً',
        price: '0.00'
      }
    ];
  }
};

// 🟢 بدون async (أسرع)
const calculatePrice = (id, s, commissions) => {
  let final = 0;

  switch (id) {
    case 'lira_5':
      final = ((s + commissions[0].value) / 31.1) * 5 * JOD_EXCHANGE_RATE;
      break;

    case 'ounce_100':
      final = ((s + commissions[1].value) / 31.1) * 100 * JOD_EXCHANGE_RATE;
      break;

    case 'ounce_31':
      final = (s + commissions[2].value) * JOD_EXCHANGE_RATE;
      break;

    case 'swiss_kilo':
      final = (s + commissions[3].value) * 32.15 * JOD_EXCHANGE_RATE;
      break;

    case 'uae_kilo':
      final = (s + commissions[4].value) * 32.15 * JOD_EXCHANGE_RATE;
      break;
  }

  return final;
};

exports.getInvestment = getInvestment;