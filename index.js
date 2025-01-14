const express = require('express');
const bodyParser = require('body-parser');
const { Op } = require('sequelize');
const db = require('./models');

const app = express();

app.use(bodyParser.json());
app.use(express.static(`${__dirname}/static`));

app.get('/api/games', (req, res) => db.Game.findAll()
  .then((games) => res.send(games))
  .catch((err) => {
    console.log('There was an error querying games', JSON.stringify(err));
    return res.send(err);
  }));

app.post('/api/games', (req, res) => {
  const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
  return db.Game.create({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
    .then((game) => res.send(game))
    .catch((err) => {
      console.log('***There was an error creating a game', JSON.stringify(err));
      return res.status(400).send(err);
    });
});

app.delete('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then((game) => game.destroy({ force: true }))
    .then(() => res.send({ id }))
    .catch((err) => {
      console.log('***Error deleting game', JSON.stringify(err));
      res.status(400).send(err);
    });
});

app.put('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then((game) => {
      const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
      return game.update({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
        .then(() => res.send(game))
        .catch((err) => {
          console.log('***Error updating game', JSON.stringify(err));
          res.status(400).send(err);
        });
    });
});

app.post('/api/games/search', async (req, res) => {
  try {
    const { name, platform } = req.body;

    // Input validation
    if (name && typeof name !== 'string') {
      return res.status(400).json({
        error: 'Invalid input',
        details: 'Name must be a string',
      });
    }

    if (platform && typeof platform !== 'string') {
      return res.status(400).json({
        error: 'Invalid input',
        details: 'Platform must be a string',
      });
    }

    // Sanitize inputs
    const sanitizedName = name ? name.trim() : null;
    const sanitizedPlatform = platform ? platform.trim().toLowerCase() : null;

    // Build the query conditions
    const whereClause = {};

    if (sanitizedName) {
      whereClause.name = {
        [Op.like]: `%${sanitizedName}%`,
      };
    }

    if (sanitizedPlatform) {
      whereClause.platform = sanitizedPlatform;
    }

    // Query the database with the conditions
    const games = await db.Game.findAll({
      where: whereClause,
    });

    // Handle no results found
    if (games.length === 0) {
      return res.status(404).json({
        message: 'No games found matching the search criteria',
      });
    }

    return res.status(200).json(games);
  } catch (error) {
    console.error('Search error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your request',
      requestId: Date.now(),
    });
  }
});

app.listen(3000, () => {
  console.log('Server is up on port 3000');
});

module.exports = app;
