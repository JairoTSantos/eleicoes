const express = require('express');
const router = express.Router();
const EleicoesController = require('../controller/EleicoesController');


//SINCRONIZA O BANCO
router.get('/eleicoes-sync', EleicoesController.SyncModel);

//PEGAS OS ARQUIVOS NO CDN DO TSE
router.get('/pegar-arquivos-tse', EleicoesController.GetArquivosCsv);

//PEGA OS RESULTADOS NO CSV
router.get('/salvar-resultados', EleicoesController.SalvarResultados);

//MOSTRA OS RESULTADOS COM FILTROS
router.get('/resultados', EleicoesController.Resultados);

//MOSTRA AS ELEICOES QUE O DEP DISPUTOU
router.get('/eleicoes-disputadas', EleicoesController.EleicoesDisputadas);

//MOSTRA OS CARGOS QUE O DEP DISPUTOU
router.get('/cargos-disputados', EleicoesController.CargosDisputados);




module.exports = router;