const { User } = require("../models");

const getUser = async (userId) => {
  if (!userId) return null;
  return await User.findByPk(userId);
};

module.exports = getUser;