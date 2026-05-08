const express = require('express');
const router = express.Router();
const {Favorite,Product} = require('../models');
const { getFavourates, deleteFavourate, addFavourate } = require('../controllers/favorite.controller');

router.get('/view/:id', getFavourates);

router.delete('/delete/:favoriteId',deleteFavourate);

router.post('/add',addFavourate);

router.post('/toggle', async (req, res) => {
  const { userId, productId } = req.body;
  try {
    const favorite = await Favorite.findOne({ where: { userId, productId } });
    if (favorite) {
      await favorite.destroy();
      return res.json({ status: "success", action: "removed" });
    } else {
      await Favorite.create({ userId, productId });
      return res.json({ status: "success", action: "added" });
    }
  } catch (error) {
    res.status(500).json({ status: "failure", message: error.message });
  }
});

module.exports = router;