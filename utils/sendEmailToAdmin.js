const nodemailer = require('nodemailer');

const sendEmailNotificationToAdmin = async (subject, htmlContent) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "elitesilver925.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const primaryAdmin = process.env.ADMIN_NOTIFICATION_EMAIL || "odehbarhouma@gmail.com";
    const recipientEmails = [primaryAdmin];

    try {
      const { User } = require('../models');
      if (User) {
        const admins = await User.findAll({ where: { role: 'admin' }, attributes: ['email'] });
        admins.forEach(a => {
          if (a.email && !recipientEmails.includes(a.email)) {
            recipientEmails.push(a.email);
          }
        });
      }
    } catch (dbErr) {
      // Continue with primary admin if DB lookup fails
    }

    const mailOptions = {
      from: `"نظام إيليت سيلفر 925" <${process.env.EMAIL_USER}>`,
      to: recipientEmails.join(', '),
      subject: subject,
      html: `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px; max-width: 650px; margin: 0 auto; background-color: #ffffff; color: #1e293b; line-height: 1.6;">
          ${htmlContent}
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;">
          <p style="font-size: 11px; color: #64748b; text-align: center; margin: 0;">
            إشعار تلقائي من نظام إدارة الفروع والمبيعات - مصوغات إيليت سيلفر 925 (يرجى عدم الرد على هذه الرسالة).
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Admin email sent successfully: ${subject} to [${recipientEmails.join(', ')}]`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send admin email (${subject}):`, error.message);
    return null;
  }
};

module.exports = sendEmailNotificationToAdmin;