const EleicoesModel = require('../model/EleicoesModel');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const sequelize = require('../database/database');


require('dotenv').config();

class EleicoesController {

    constructor() {
        this.SalvarResultados = this.SalvarResultados.bind(this);
        this.GetDadosCSV = this.GetDadosCSV.bind(this);
    }

    async SalvarResultados(req, res) {
        try {
            const result = await this.GetDadosCSV('./src/csv/2022/votacao_candidato_munzona_2022_AP.csv');
            return res.status(200).json({ status: 200, message: 'ok', dados: result });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Erro interno do servidor', error: error.message });
        }
    }

    async GetDadosCSV(caminhoArquivo) {
        const resultados = [];
        const totalVotosPorCargo = {}; // Objeto para armazenar votos por cargo
        let totalVotosDeputado = 0;

        return new Promise((resolve, reject) => {
            fs.createReadStream(caminhoArquivo)
                .pipe(iconv.decodeStream('latin1'))
                .pipe(csv({ separator: ';' }))
                .on('data', (data) => {
                    const cargo = data.DS_CARGO; // Captura o nome do cargo
                    const votos = parseInt(data.QT_VOTOS_NOMINAIS, 10); // Captura o número de votos

                    // Acumula os votos por cargo
                    if (!totalVotosPorCargo[cargo]) {
                        totalVotosPorCargo[cargo] = 0; 
                    }
                    totalVotosPorCargo[cargo] += votos;

                    // Verifica se o candidato atual é o deputado procurado
                    if (data.NM_URNA_CANDIDATO === process.env.NOME_DEPUTADO ||
                        data.NM_URNA_CANDIDATO.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase() === process.env.NOME_DEPUTADO.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase()) {
                        totalVotosDeputado += votos;
                        resultados.push(data);
                    }
                })
                .on('end', () => {
                    console.log(totalVotosPorCargo); // Exibe o total de votos por cargo
                    console.log(totalVotosDeputado); // Exibe os votos do deputado específico
                    resolve(resultados);
                })
                .on('error', (error) => {
                    console.error(error);
                    reject(error);
                });
        });
    }



    async GetArquivosCsv(req, res) {
        const primeiraEleicao = parseInt(process.env.PRIMEIRA_ELEICAO, 10);
        const ultimaEleicao = parseInt(process.env.ULTIMA_ELEICAO, 10);

        for (let ano = primeiraEleicao; ano <= ultimaEleicao; ano += 2) {
            const url = `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_${ano}.zip`;
            const zipFilePath = path.join(__dirname, `../temp/votacao_candidato_munzona_${ano}.zip`);
            const outputDir = path.join(__dirname, '../csv/', ano.toString());
            const csvFileName = `votacao_candidato_munzona_${ano}_${process.env.ESTADO_DEPUTADO}.csv`;

            try {

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const response = await axios.get(url, { responseType: 'arraybuffer' });


                if (response.status !== 200) {
                    throw new Error(`Falha ao baixar o arquivo para o ano ${ano}: ${response.statusText}`);
                }


                fs.writeFileSync(zipFilePath, response.data);


                const zip = new AdmZip(zipFilePath);
                const zipEntries = zip.getEntries();


                const csvEntry = zipEntries.find(entry => entry.entryName === csvFileName);

                if (csvEntry) {
                    zip.extractEntryTo(csvEntry.entryName, outputDir, false, true);
                } else {
                    console.warn(`Arquivo ${csvFileName} não encontrado no ZIP para o ano ${ano}.`);
                }

                fs.unlinkSync(zipFilePath);

            } catch (error) {
                console.error(`Erro ao processar o ano ${ano}: ${error.message}`);
                continue;
            }
        }
        return res.status(200).json({ status: 200, message: 'Todos os arquivos foram processados!' });
    }


    async SyncModel(req, res) {
        try {
            await EleicoesModel.sync({ alter: true });
            return res.status(200).json({ status: 200, message: 'Modelo sincronizado' });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Erro interno do servidor' });
        }
    }



}

module.exports = new EleicoesController();
