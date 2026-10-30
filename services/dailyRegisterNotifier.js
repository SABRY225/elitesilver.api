const cron = require('node-cron');
const db = require('../models');
const { Branch, BranchDailyRegister } = db;
const { sendDailyRegisterClosureEmail } = require('../controllers/branch.controller');

/**
 * فحص وإغلاق السجلات اليومية للفروع تلقائياً عند انتهاء موعد الدوام الرسمي
 * موعد التشغيل: الساعة 11:05 مساءً يومياً بتوقيت الأردن (Asia/Amman)
 */
const autoCloseDailyRegisters = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`⏰ [Cron] فحص السجلات اليومية للفروع لتاريخ ${today}...`);

    const branches = await Branch.findAll({ where: { status: 'نشط' } });
    if (!branches || branches.length === 0) return;

    for (const branch of branches) {
      try {
        const register = await BranchDailyRegister.findOne({
          where: { branchId: branch.id, date: today }
        });

        if (register) {
          const notes = register.notes || '';
          const alreadySent = notes.includes('[EMAIL_CLOSED_SENT]');

          // إذا كان السجل مسجلاً ولم يُرسل تقرير إغلاقه بعد للإدارة
          if (!alreadySent) {
            console.log(`📧 [Cron] إغلاق وإرسال تقرير السجل اليومي لفرع: ${branch.name}`);
            const updatedNotes = `${notes} [EMAIL_CLOSED_SENT]`.trim();
            await register.update({
              status: 'مغلق',
              notes: updatedNotes
            });

            await sendDailyRegisterClosureEmail(register, branch.name, true);
          }
        }
      } catch (branchErr) {
        console.error(`خطأ أثناء معالجة السجل اليومي لفرع #${branch.id}:`, branchErr.message);
      }
    }
  } catch (err) {
    console.error("خطأ عام في مهمة الجدولة لإغلاق السجلات اليومية:", err);
  }
};

// جدولة المهمة يومياً الساعة 11:59 مساءً (23:59) بتوقيت الأردن
cron.schedule('59 23 * * *', () => {
  console.log('⏰ بدء الجدولة اليومية لإغلاق السجلات اليومية وإرسال تقارير الإدارة...');
  autoCloseDailyRegisters();
}, {
  scheduled: true,
  timezone: "Asia/Amman"
});

module.exports = autoCloseDailyRegisters;
