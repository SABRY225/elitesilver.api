const handlePointsPayment = async (user, paymentMethod, total) => {
  if (!user || paymentMethod !== "points") return;

  const pointsInMoney = Number(user.points) * 0.05;

  if (pointsInMoney < Number(total)) {
    throw new Error(
      `رصيد النقاط غير كافٍ. القيمة الحالية ${pointsInMoney.toFixed(2)} دينار`
    );
  }

  const pointsToDeduct = Number(total) * 20;

  await user.decrement("points", {
    by: pointsToDeduct,
  });
};

module.exports = handlePointsPayment;