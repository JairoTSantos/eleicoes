const express = require('express');
const router = express.Router();
const EleicoesController = require('../controller/EleicoesController');


router.get('/eleicoes-sync', EleicoesController.SyncModel);
router.get('/resultados', EleicoesController.SalvarResultados);

module.exports = router;