const nodemailer = require('nodemailer');

const sendEmailNotificationToAdmin = async ( subject, htmlContent) => {
    const transporter = nodemailer.createTransport({
      host: "elitesilver925.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
        from: `"قسم المبيعات" <${process.env.EMAIL_USER}>`,
        to: "odehbarhouma@gmail.com",
        subject: subject,
        html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                ${htmlContent}
                <hr>
                <p style="font-size: 12px; color: #777;">هذا البريد تم إرساله تلقائياً، يرجى عدم الرد عليه.</p>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

module.exports = sendEmailNotificationToAdmin;