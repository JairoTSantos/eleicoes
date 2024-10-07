const express = require('express');
const router = express.Router();



router.get('/', (req, res) => {
    res.send('Hello World!');
});


const eleicoesRoute = require('./EleicoesRoute');
router.use('/api', eleicoesRoute);

module.exports = router;
