const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { Product, Category } = require('../models'); // تأكد من استيراد موديل Category
const { Op } = require('sequelize');

const transporter = nodemailer.createTransport({
    host: "elitesilver925.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const LOW_STOCK_THRESHOLD = 5;

const sendStockReport = async () => {
    try {
        // جلب المنتجات مع بيانات القسم (الفرع) المرتبط بها
        const outOfStockProducts = await Product.findAll({
            where: { stock: 0 },
            include: [{ model: Category, as: 'category' }] // جلب بيانات الفرع
        });

        const lowStockProducts = await Product.findAll({
            where: {
                stock: {
                    [Op.gt]: 0,
                    [Op.lte]: LOW_STOCK_THRESHOLD
                }
            },
            include: [{ model: Category, as: 'category' }] // جلب بيانات الفرع
        });

        if (outOfStockProducts.length === 0 && lowStockProducts.length === 0) {
            console.log('المخزون سليم، لا حاجة لإرسال إيميل اليوم.');
            return;
        }

        let emailContent = `<h2>تقرير المخزون اليومي - Elite Silver</h2>`;

        if (outOfStockProducts.length > 0) {
            emailContent += `<h3 style="color: red;">⚠️ منتجات نفذت من المخزن:</h3><ul>`;
            outOfStockProducts.forEach(p => {
                const branchName = p.branch ? p.branch : 'غير محدد';
                emailContent += `<li>المنتج: <b>${p.name}</b> | SKU: <b>${p.sku}</b> | الفرع: <b style="color: blue;">${branchName}</b></li>`;
            });
            emailContent += `</ul>`;
        }

        if (lowStockProducts.length > 0) {
            emailContent += `<h3 style="color: orange;">🔔 منتجات مخزونها منخفض:</h3><ul>`;
            lowStockProducts.forEach(p => {
                const branchName = p.branch ? p.branch : 'غير محدد';
                emailContent += `<li>المنتج: <b>${p.name}</b> | SKU: <b>${p.sku}</b> | الكمية: <b>${p.stock}</b> | الفرع: <b style="color: blue;">${branchName}</b></li>`;
            });
            emailContent += `</ul>`;
        }
        // odehbarhouma@gmail.com
        // ahmedsabrymahmoud225@gmail.com
        // إرسال الإيميل
        await transporter.sendMail({
            from: '"Elite Silver System" <info@elitesilver925.com>',
            to: 'odehbarhouma@gmail.com', 
            subject: '⚠️ تقرير نقص المخزون اليومي والفرع',
            html: emailContent
        });

        console.log('تم إرسال تقرير المخزون بنجاح للأدمن مع أسماء الفروع.');

    } catch (error) {
        console.error('خطأ في إرسال تقرير المخزون:', error);
    }
};

// جدولة المهمة يومياً الساعة 12:00 ظهراً بتوقيت الأردن
cron.schedule('0 12 * * *', () => {
    console.log('بدء فحص المخزون اليومي...');
    sendStockReport();
}, {
    scheduled: true,
    timezone: "Asia/Amman"
});

// cron.schedule('* * * * *', () => {
//     console.log('بدء فحص المخزون اليومي...');
//     sendStockReport();
// });

module.exports = sendStockReport;