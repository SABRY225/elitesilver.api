const sendEmailNotification = require("../utils/sendEmail");
const sendEmailNotificationToAdmin = require("../utils/sendEmailToAdmin");

const sendOrderEmails = async (user, data) => {
  const email = user?.email || data.email;

  if (email) {
    const html = `<h2>شكراً لطلبك!</h2>
      <p>تم استلام طلبك بقيمة ${data.total} دينار</p>`;

    await sendEmailNotification(email, "تأكيد الطلب", html)
      .catch(console.error);
  }

  const adminHtml = `<h2>طلب جديد من ${data.fullName}</h2>
    <p>بقيمة ${data.total}</p>`;

  await sendEmailNotificationToAdmin("طلب جديد", adminHtml)
    .catch(console.error);
};

module.exports = sendOrderEmails;