const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('api', 'jairo', 'intell01', {
    host: 'localhost',
    dialect: 'mysql',
    port: 3306,
    logging: false,
});

module.exports = sequelize;
