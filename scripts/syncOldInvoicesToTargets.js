/**
 * سكريبت إعادة فحص وإسناد الفواتير القديمة إلى موظفي الفروع ومزامنة التارجت
 * -------------------------------------------------------------
 * التشغيل من الطرفية (Terminal):
 *   node backend/scripts/syncOldInvoicesToTargets.js
 * 
 * خيارات إضافية (اختيارية):
 *   node backend/scripts/syncOldInvoicesToTargets.js --dry-run      (معاينة فقط دون تعديل في قاعدة البيانات)
 *   node backend/scripts/syncOldInvoicesToTargets.js --branch=1     (فحص فرع معين فقط)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const db = require('../models');
const { syncOldInvoicesLogic } = require('../controllers/branch.controller');

async function run() {
  console.log('\n======================================================');
  console.log('  بدء فحص وإسناد الفواتير القديمة لموظفي الفروع وتحديث التارجت  ');
  console.log('======================================================\n');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const branchArg = args.find(a => a.startsWith('--branch='));
  const branchId = branchArg ? parseInt(branchArg.split('=')[1], 10) : null;

  if (dryRun) {
    console.log('⚠️ [وضع المعاينة - DRY RUN]: لن يتم إجراء أي تعديل فعلي في قاعدة البيانات.\n');
  }
  if (branchId) {
    console.log(`🎯 الفحص مخصص للفرع رقم: #${branchId}\n`);
  }

  try {
    const startTime = Date.now();
    const result = await syncOldInvoicesLogic({ branchId, dryRun });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('------------------------------------------------------');
    console.log(`📋 إجمالي الفواتير المفحوصة:         ${result.invoicesScanned}`);
    console.log(`✅ فواتير مسندة مسبقاً لموظف:       ${result.invoicesAlreadyAssigned}`);
    console.log(`🎉 فواتير قديمة تم إسنادها بنجاح:    ${result.invoicesNewlyAssigned}`);
    console.log(`❓ فواتير لم يُعثر على موظف لها:      ${result.invoicesUnassigned}`);
    console.log('------------------------------------------------------');
    console.log(`📖 إجمالي دفاتر السجلات اليومية المفحوصة: ${result.registersScanned}`);
    console.log(`✍️  أسطر السجل اليومي المحدثة بالموظف:  ${result.registerEntriesUpdated}`);
    console.log('------------------------------------------------------\n');

    if (result.assignedDetails && result.assignedDetails.length > 0) {
      console.log('تفاصيل الفواتير التي تم إسنادها:');
      console.table(
        result.assignedDetails.map(d => ({
          'رقم الفاتورة': `#${d.invoiceNumber}`,
          'التاريخ': d.date,
          'المبلغ (د.أ)': `${d.total} د.أ`,
          'الفرع': `#${d.branchId}`,
          'الموظف المسند إليه': d.employeeName,
          'سبب ومصدر الإسناد': d.reason
        }))
      );
    } else {
      console.log('معلومة: لم يتم العثور على أي فواتير قديمة غير مسندة، جميع الفواتير مرتبطة بموظفيها بالفعل! 👍\n');
    }

    console.log(`\n✨ اكتملت العملية بنجاح في ${duration} ثانية.`);
    console.log('======================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ حدث خطأ أثناء تنفيذ الفحص والإسناد:', error);
    process.exit(1);
  }
}

run();

