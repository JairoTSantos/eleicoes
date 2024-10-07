const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('api', 'root', 'root', {
    host: 'localhost',
    dialect: 'mysql',
    port: 8889
});

module.exports = sequelize;
