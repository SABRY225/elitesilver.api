const { City } = require("../models");

const validateCity = async (cityId) => {
  return await City.findByPk(cityId);
};

module.exports = validateCity;