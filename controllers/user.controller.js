const {Order, CustomOrder, Product, OrderCashierSystem, OrderSilver } = require("../models");
const { User } = require('../models');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();
// جلب بيانات الشخص الحالي
exports.getMe = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  res.json(user);
};

// جلب إحصائيات لوحة التحكم
exports.getStats = async (req, res) => {
  const totalOrders = await Order.count();
  const categories = await Category.count();
  const products = await Product.count();
  const totalSales = await Order.sum('totalPrice');
  res.json({ totalOrders, totalSales ,products ,categories});
};

exports.getUsers = async (req, res) => {
  const users = await User.findAll({ attributes: ['id', 'name', 'email', 'phone', 'address', 'role', 'isVerified'] });
  res.json(users);
};


exports.registerAccount = async (req, res) => {
  try {
    const { name, email,phone,address } = req.body;
    let user = await User.findOne({ where: { email } });
    if (user) {
      return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    }
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    user = await User.create({ name, email, phone, address, verificationCode: otp ,role:'customer'});
    // إعداد مرسل البريد (استخدم بيانات Gmail الخاصة بك أو أي خدمة SMTP)
    const transporter = nodemailer.createTransport({
      host: "elitesilver925.com",
      port: 465,
      secure: true, 
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    // تصميم الإيميل الاحترافي (HTML)
    const mailOptions = {
      from: `"ELITE SILVER 925 ✨" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'رمز التحقق الخاص بك',
      html: `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #f0f0f0; border-radius: 20px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #1c2127; padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">ELITE SILVER 925</h1>
          </div>
          <div style="padding: 40px 30px; text-align: center;">
            <h2 style="color: #1e293b; margin-bottom: 20px;">مرحباً بك!</h2>
            <p style="color: #64748b; font-size: 16px; line-height: 1.6;">لقد طلبت رمز التحقق لتسجيل الدخول إلى حسابك. يرجى استخدام الرمز التالي لإتمام العملية:</p>
            <div style="margin: 30px 0;">

              <span style="background-color: #f8fafc; border: 2px dashed #1c2127; color: #1c2127; padding: 15px 40px; font-size: 32px; font-weight: bold; border-radius: 12px; letter-spacing: 5px;">
                ${otp}
              </span>
            </div>
            <p style="color: #94a3b8; font-size: 14px;">هذا الرمز صالح لمدة 10 دقائق فقط. إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.</p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">شكراً لثقتكم بنا ❤️
          </div>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: 'تم إرسال رمز التحقق لبريدك الإلكتروني بنجاح' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب', message: error.message });
  }
}

exports.login = async (req, res) => {
  try {
    const { email } = req.body;
    console.log(email);
    
    const user = await User.findOne({ where: { email } });  
    if (!user) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير موجود' });
    }
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    user.verificationCode = otp;
    await user.save();
    // إعداد مرسل البريد (استخدم بيانات Gmail الخاصة بك أو أي خدمة SMTP)
    const transporter = nodemailer.createTransport({
      host: "elitesilver925.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    // تصميم الإيميل الاحترافي (HTML)
    const mailOptions = {
      from: `"ELITE SILVER 925 ✨" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'رمز التحقق الخاص بك',
      html: `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #f0f0f0; border-radius: 20px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #1c2127; padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">ELITE SILVER 925</h1>
          </div>
          <div style="padding: 40px 30px; text-align: center;">
            <h2 style="color: #1e293b; margin-bottom: 20px;">مرحباً بك!</h2>
            <p style="color: #64748b; font-size: 16px; line-height: 1.6;">لقد طلبت رمز التحقق لتسجيل الدخول إلى حسابك. يرجى استخدام الرمز التالي لإتمام العملية:</p>
            <div style="margin: 30px 0;">
              <span style="background-color: #f8fafc; border: 2px dashed #1c2127; color: #1c2127; padding: 15px 40px; font-size: 32px; font-weight: bold; border-radius: 12px; letter-spacing: 5px;">
                ${otp}
              </span>
            </div>
            <p style="color: #94a3b8; font-size: 14px;">هذا الرمز صالح لمدة 10 دقائق فقط. إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.</p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">شكراً لثقتكم بنا ❤️
          </div>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: 'تم إرسال رمز التحقق لبريدك الإلكتروني بنجاح' });
  }catch(error){
    console.error(error);    
    return res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول', message: error.message });
  }
}


exports.sendOTP = async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  try {
    let user = await User.findOne({ where: { email } });
    // إذا كان المستخدم جديداً ننشئه، وإذا كان موجوداً نحدث الكود
    if (!user) 
    {
      return res.status(500).json({ error: 'البريد غير موجود من الاساس' });
    }
    else{
      user.verificationCode = otp;
      await user.save();
    }

    // إعداد مرسل البريد (استخدم بيانات Gmail الخاصة بك أو أي خدمة SMTP)
 const transporter = nodemailer.createTransport({
      host: "elitesilver925.com",
      port: 465,
      secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

    // تصميم الإيميل الاحترافي (HTML)
    const mailOptions = {
      from: `"ELITE SILVER 925 ✨" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'رمز التحقق الخاص بك',
      html: `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #f0f0f0; border-radius: 20px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #1c2127; padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">ELITE SILVER 925</h1>
          </div>
          
          <div style="padding: 40px 30px; text-align: center;">
            <h2 style="color: #1e293b; margin-bottom: 20px;">مرحباً بك!</h2>
            <p style="color: #64748b; font-size: 16px; line-height: 1.6;">لقد طلبت رمز التحقق لتسجيل الدخول إلى حسابك. يرجى استخدام الرمز التالي لإتمام العملية:</p>
            
            <div style="margin: 30px 0;">
              <span style="background-color: #f8fafc; border: 2px dashed #1c2127; color: #1c2127; padding: 15px 40px; font-size: 32px; font-weight: bold; border-radius: 12px; letter-spacing: 5px;">
                ${otp}
              </span>
            </div>
            
            <p style="color: #94a3b8; font-size: 14px;">هذا الرمز صالح لمدة 10 دقائق فقط. إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.</p>
          </div>
          
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">شكراً لثقتكم بنا ❤️
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: 'تم إرسال رمز التحقق لبريدك الإلكتروني بنجاح' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'حدث خطأ أثناء إرسال البريد الإلكتروني',message:error.message });
  }
};

// 2. التحقق من الرمز وتسجيل الدخول
exports.verifyOTP = async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await User.findOne({ where: { email, verificationCode: code } });

    if (!user) {
      return res.status(400).json({ error: 'الرمز غير صحيح أو البريد خاطئ' });
    }

    // تفعيل الحساب وتصفير الكود
    user.isVerified = true;
    user.verificationCode = null;
    await user.save();

    // إنشاء توكن JWT
    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    const orders = await Order.count({ where: { userId: user.id } });
    const ordersCashier = await OrderCashierSystem.count({ where: { userId: user.id } });
    const orderSilver = await OrderSilver.count({ where: { userId: user.id } });
    const totalOrders = orders + ordersCashier + orderSilver;
    return res.status(200).json({ 
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: { id: user.id, name: user.name, role: user.role, permissions: JSON.parse(user.permissions),points:user.points,orderCounter:totalOrders }
    });
  } catch (error) {

    return res.status(500).json({ error: 'خطأ في عملية التحقق',message:error.message });
  }
};


exports.searchCustomer = async (req, res) => {
  try {
    const { phone } = req.query;
   console.log(`+962${phone}`);
   
    const customer = await User.findOne({ where: { phone: `+962${phone}` } });
    
    if (customer) {
      return res.status(200).json(customer);
    }
    res.status(404).json({ message: "Customer not found" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.createCustomer = async (req, res) => {
  try {
    const customer = await User.create(req.body);
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ error: error });
  }
};