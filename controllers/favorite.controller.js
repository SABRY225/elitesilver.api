const { Favorite, Product } = require("../models");

exports.getFavourates = async (req, res) => {
  try {
    const favorites = await Favorite.findAll({
      where: { userId: req.params.id },
      include: [Product]
    });

    const data = favorites.map(f => {
      if (!f.Product) return null;

      return {
        ...f.Product.toJSON(), 
        favorite_id: f.id     
      };
    }).filter(item => item !== null);

    return res.status(200).json({ status: "success", data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      status: "error", 
      message: "حدث خطأ أثناء جلب المفضلة: " + error.message 
    });
  }
};

exports.deleteFavourate= async (req, res) => {
  try {
    const result = await Favorite.destroy({ where: { id: req.params.favoriteId } });
      return res.status(200).json({ status: "success" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
}

exports.addFavourate=  async (req, res) => {
  const { userId, productId } = req.body;

  try {
    const exists = await Favorite.findOne({
      where: { 
        userId: userId, 
        productId: productId 
      }
    });

    if (exists) {
      return res.json({ 
        status: "failure", 
        id:exists.id,
        message: "المنتج موجود بالفعل في المفضلة" 
      });
    }

    // 2. إنشاء سجل جديد
    const newFavorite = await Favorite.create({
      userId: userId,
      productId: productId
    });

    res.json({ 
      status: "success", 
      data: newFavorite 
    });

  } catch (error) {
    res.status(500).json({ 
      status: "error", 
      message: error.message 
    });
  }
}