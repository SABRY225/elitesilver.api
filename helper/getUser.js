const { User } = require("../models");

const getUserFun = async (userId) => {
  if (!userId) return null;
  return await User.findByPk(userId);
};

module.exports = getUserFun;