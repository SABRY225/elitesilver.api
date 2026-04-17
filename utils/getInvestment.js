
const axios = require('axios');
const JOD_EXCHANGE_RATE = 0.7080;


const getInvestment = async()=>{
    const response = await axios.get(
          'https://api.gold-api.com/price/XAG/USD'
        );
    
        const silverPrice = response.data.price;
    
        // 2️⃣ المنتجات
        const items = [
          {
            id: 'uae_kilo',
            image: 'https://cdn.salla.sa/aobdW/47c41a10-5457-4d8e-a857-36bf2816007f-1000x1000-N8TP2NX0qs9YJXDbzChLPYDaNKep0XT5zl2a1bUw.jpg',
            name: 'كيلو فضة إماراتي 999',
          },
          {
            id: 'swiss_kilo',
            image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYvVW9ixZqisTh_pL9ej0x0QPXKlvsx-f5vw&s',
            name: 'كيلو فضة سويسري',
          },
          {
            id: 'ounce_31',
            image: 'https://cdn.salla.sa/YgBeDO/15f02cc5-8274-4b38-9900-4ddcc1dbdec4-830.40935672515x1000-WRxOCP5bp7cq5RbqYBbMXpzkDW9kZB3oJwGNqTub.jpg',
            name: 'أونصة 31.1 جرام',
          },
          {
            id: 'ounce_100',
            image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQuNPQaxc3a93MnJO4c3yBJWU-SiX7SCl0-RA&s',
            name: 'سبيكة فضة 100 جرام',
          },
          {
            id: 'lira_5',
            image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT29Jy0B8BuSYzhFRoc7TtY-IKxNUR8-jtBOg&s',
            name: 'ليرة فضة فنية 5 جرام',
          }
        ];
    
        // 3️⃣ حساب الأسعار
        const result = items.map(item => ({
          id: item.id,
          image: item.image,
          name: item.name,
          price: parseFloat(calculatePrice(item.id, silverPrice).toFixed(2))
        }));
    
        return result;
}

const calculatePrice = (id, s) => {
  let final = 0;

  switch (id) {
    case 'uae_kilo':
      final = (s + 5) * 32.15 * JOD_EXCHANGE_RATE;
      break;

    case 'swiss_kilo':
      final = (s + 9) * 32.15 * JOD_EXCHANGE_RATE;
      break;

    case 'ounce_31':
      final = (s + 12) * JOD_EXCHANGE_RATE;
      break;

    case 'ounce_100':
      final = ((s + 11) / 31.1) * 100 * JOD_EXCHANGE_RATE;
      break;

    case 'lira_5':
      final = ((s + 30) / 31.1) * 5 * JOD_EXCHANGE_RATE;
      break;

    default:
      final = 0;
  }

  return final;
};

exports.getInvestment = getInvestment;