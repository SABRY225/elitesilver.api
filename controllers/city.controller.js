const { City } = require("../models");

exports.getShippingCities = async (req, res) => {
    try {
        const cities = await City.findAll({ order: [['createdAt', 'DESC']] });
        res.json(cities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

exports.addShippingCity = async (req, res) => {
    try {
        const { name, price } = req.body;
        const newCity = await City.create({ name, price });
        res.status(201).json(newCity);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}
exports.deleteShippingCity = async (req, res) => {
    try {
        const result = await City.destroy({
            where: { id: req.params.id }
        });
        if (result) {
            res.json({ message: "City deleted successfully" });
        } else {
            res.status(404).json({ message: "City not found" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateShippingCity = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price } = req.body;

        const city = await City.findByPk(id);
        if (!city) return res.status(404).json({ message: "المدينة غير موجودة" });

        await city.update({ name, price });
        
        res.status(200).json(city);
    } catch (error) {
        res.status(500).json({ message: "خطأ في التعديل" });
    }
};