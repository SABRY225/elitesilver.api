const sendEmailNotification = require("../utils/sendEmail");
const sendEmailNotificationToAdmin = require("../utils/sendEmailToAdmin");

const sendSilverOrderEmails = async (user, data) => {
  const email = user?.email || data.email;

  if (email) {
    const html = `
      <h2>شكراً لطلبك!</h2>
      <p>تم استلام طلبك بقيمة ${data.total_price.toFixed(2)} دينار</p>
    `;

    await sendEmailNotification(email, "تأكيد الطلب", html)
      .catch(console.error);
  }

  const adminHtml = `
    <h2>طلب فضة جديد من ${data.fullName}</h2>
    <p>بقيمة ${data.total_price.toFixed(2)} دينار</p>
  `;

  await sendEmailNotificationToAdmin("طلب فضة جديد", adminHtml)
    .catch(console.error);
};

module.exports = sendSilverOrderEmails;