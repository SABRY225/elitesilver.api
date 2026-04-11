const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// إعداد مكان تخزين الصور
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // تأكد من إنشاء مجلد باسم uploads في جذر المشروع
  },
  filename: (req, file, cb) => {
    // تسمية الصورة برقم فريد + اسمها الأصلي لتجنب التكرار
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// إعداد multer للصور المتعددة
const uploadMultiple = upload.fields([
  { name: 'image', maxCount: 1 },           // الصورة الرئيسية
  { name: 'galleryImages', maxCount: 10 }   // الصور الإضافية (حد أقصى 10)
]);
// استيراد حماية المسارات (Middleware)
const adminAuth = require('../middleware/adminAuth');
const userAuth = require('../middleware/userAuth');
const { sendOTP, verifyOTP, getMe, registerAccount, login } = require('../controllers/user.controller');
const { getAll, add, deleteProduct, updateProduct, getProduct, searchProducts } = require('../controllers/product.controller');
const {  getAllCategories, addCategory, updateCategory, deleteCategory } = require('../controllers/customOrder.controller');
const { createOrder, getAllOrders, updateStatus, getOrdersByUser, createOrderSilver, getOrdersSilverByUser, getOrdersSilver, updateStatusOrderSilver } = require('../controllers/order.controller');
const { getDashboardStats, getAdmins, getUsers, addAdmin, updateAdmin, deleteAdmin } = require('../controllers/admin.controller');
const { addRating, getProductRatings, updateRating, deleteRating, getUserRatings, getReviewsAdmin, deleteRatingByAdmin } = require('../controllers/rating.controller');
const { City } = require('../models');
const { updateShippingCity, deleteShippingCity, addShippingCity, getShippingCities } = require('../controllers/city.controller');

// --- مسارات الهوية (Authentication) ---
router.post('/auth/register', registerAccount); // تسجيل جديد (يرسل OTP)
router.post('/auth/login', login); // تسجيل دخول (يرسل OTP)
router.post('/auth/login-request', sendOTP); // إرسال الكود
router.post('/auth/verify-code', verifyOTP); // التحقق والدخول
router.get('/auth/me', adminAuth, getMe); 

// // --- مسارات المتجر (Public) ---
router.get('/products', getAll); // جلب كل المنتجات
router.get('/products/search', searchProducts); // البحث في المنتجات
router.get('/products/:id', getProduct); // جلب كل المنتجات
router.get('/categories', getAllCategories); // جلب كل التصنيفات
router.post('/orders/new', createOrder); // إنشاء طلب جديد من عميل
router.post('/orders/silver', createOrderSilver); // إنشاء طلب جديد من عميل
router.get('/orders/:userId', getOrdersByUser); // جلب طلبات مستخدم معين
router.get('/orders-silver/:userId', getOrdersSilverByUser); // جلب طلبات مستخدم معين

// // --- مسارات التقييمات (Public) ---
router.get('/products/:productId/ratings', getProductRatings); // جلب تقييمات المنتج

// // مسارات التقييمات (Authenticated) ---
router.post('/ratings', userAuth, addRating); // إضافة تقييم جديد
router.put('/ratings/:ratingId', userAuth, updateRating); // تحديث التقييم
router.delete('/ratings/:ratingId', userAuth, deleteRating); // حذف التقييم
router.get('/my-ratings', userAuth, getUserRatings); // جلب تقييماتي
router.get('/admin/reviews', userAuth, getReviewsAdmin);

// حذف تقييم محدد
router.delete('/admin/reviews/:id', userAuth,deleteRatingByAdmin);

// // --- مسارات الإدارة (Admin Only) ---
// // جميع المسارات القادمة تتطلب أن يكون المستخدم Admin
router.get('/admin/stats', adminAuth, getDashboardStats); // الإحصائيات
router.get('/admin/admins', adminAuth, getAdmins); 
router.post('/admin/admins', adminAuth, addAdmin);
router.put('/admin/admins/:id', adminAuth, updateAdmin);
router.delete('/admin/admins/:id', adminAuth, deleteAdmin);
router.get('/admin/users', adminAuth, getUsers); 

// // إدارة المنتجات
router.post('/admin/products', adminAuth, uploadMultiple, add);
router.put('/admin/products/:id', adminAuth, uploadMultiple, updateProduct);
router.delete('/admin/products/:id', adminAuth, deleteProduct);

// // إدارة التصنيفات
router.post('/admin/categories', adminAuth, upload.single('image'), addCategory);
router.put('/admin/categories/:id', adminAuth, upload.single('image'), updateCategory);
router.delete('/admin/categories/:id', adminAuth, deleteCategory);

// // إدارة الطلبات
router.get('/admin/orders', adminAuth, getAllOrders);
router.patch('/admin/orders/:id/status', adminAuth, updateStatus);
router.get('/admin/orders/silver', adminAuth, getOrdersSilver);
router.patch('/admin/orders/silver/:id/status', adminAuth, updateStatusOrderSilver);


router.get('/city/shipping-cities', getShippingCities);
router.post('/city/shipping-cities', addShippingCity);
router.delete('/city/shipping-cities/:id', deleteShippingCity);
router.put('/city/shipping-cities/:id', updateShippingCity);
module.exports = router;