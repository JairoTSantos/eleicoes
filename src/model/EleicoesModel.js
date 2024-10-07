const { DataTypes } = require('sequelize');
const sequelize = require('../database/database');

const Eleicoes = sequelize.define('eleicoes', {
    eleicao_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: false, 
        unique: false
    },
    eleicao_ano: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    eleicao_tipo: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    eleicao_tipo_nome: {
        type: DataTypes.STRING,
        allowNull: true,
    },
   
    eleicao_cargo_nome: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    eleicao_cargo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
  
    eleicao_estado_sigla: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    eleicao_municipio_nome: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    eleicao_municipio_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    eleicao_total_votos: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    eleicao_percentual: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    }

}, {
    sequelize,
    modelName: 'Eleicoes',
    tableName: 'eleicoes',
    timestamps: false
});

module.exports = Eleicoes;
