const express = require('express');
const bodyParser = require('body-parser');
const { Op } = require('sequelize');
const axios = require('axios');
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

/**
 * Endpoint to populate the database with top 100 games from both app stores
 *
 * Implementation notes:
 * 1. The source files (android.top100.json and ios.top100.json) contain multiple arrays of games,
 *    but we only take the first 100 games after flattening as per requirements.
 *
 * 2. Data cleanup strategy:
 *    Current implementation: We clear all existing data before inserting new games (destroy + bulkCreate)
 *    Alternative approach: We could have used an upsert strategy using bundleId as a unique identifier:
 *    - This would preserve existing games not in the top 100
 *    - Would require adding a unique constraint on bundleId in the migration
 *    - Example implementation would use bulkCreate with updateOnDuplicate option:
 *      await db.Game.bulkCreate(allGames, {
 *        updateOnDuplicate: ['name', 'publisherId', 'platform', 'storeId', 'appVersion', 'isPublished', 'updatedAt'],
 *        conflictFields: ['bundleId']
 *      });
 *
 * @route POST /api/games/populate
 * @returns {Object} Status message and count of imported games
 */
app.post('/api/games/populate', async (req, res) => {
  try {
    const urls = {
      android: 'https://interview-marketing-eng-dev.s3.eu-west-1.amazonaws.com/android.top100.json',
      ios: 'https://interview-marketing-eng-dev.s3.eu-west-1.amazonaws.com/ios.top100.json',
    };

    const [androidResponse, iosResponse] = await Promise.all([
      axios.get(urls.android),
      axios.get(urls.ios),
    ]);

    // Flatten arrays and take only first 100 games for each platform
    const androidGames = androidResponse.data
      .flat()
      .slice(0, 100)
      .map((game) => ({
        publisherId: game.publisher_id,
        name: game.name,
        platform: 'android',
        storeId: game.app_id,
        bundleId: game.bundle_id,
        appVersion: game.version,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

    const iosGames = iosResponse.data
      .flat()
      .slice(0, 100)
      .map((game) => ({
        publisherId: game.publisher_id ? game.publisher_id.toString() : null,
        name: game.name,
        platform: 'ios',
        storeId: game.app_id ? game.app_id.toString() : null,
        bundleId: game.bundle_id,
        appVersion: game.version,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

    const allGames = [...androidGames, ...iosGames];

    await db.Game.destroy({ truncate: true });
    const insertedGames = await db.Game.bulkCreate(allGames);

    return res.status(200).json({
      message: 'Database populated successfully',
      count: insertedGames.length,
      androidCount: androidGames.length,
      iosCount: iosGames.length,
    });
  } catch (error) {
    console.error('Population error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to populate the database',
      details: error.message,
    });
  }
});

app.listen(3000, () => {
  console.log('Server is up on port 3000');
});

module.exports = app;
