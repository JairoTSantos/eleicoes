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
        this.GetResultadoCSV = this.GetResultadoCSV.bind(this);
        this.SyncModel = this.SyncModel.bind(this);
    }

    async Resultados(req, res) {
        try {
            const { pagina = 1, itens = 10, ordem = 'DESC', ano, municipio } = req.query;
            const offset = (pagina - 1) * itens;

            const whereClause = {};

            if (ano) {
                whereClause.eleicao_ano = ano;
            }

            if (municipio) {
                whereClause.eleicao_municipio_id = municipio;
            }

            const sortOrder = ['ASC', 'DESC'].includes(ordem.toUpperCase()) ? ordem.toUpperCase() : 'DESC';

            const { count, rows } = await EleicoesModel.findAndCountAll({
                attributes: { exclude: ['id'] },
                order: [
                    ['eleicao_ano', sortOrder],
                    ['eleicao_total_votos', sortOrder]
                ],
                where: whereClause,
                limit: Number(itens),
                offset: Number(offset)
            });

            if (count === 0) {
                return res.status(200).json({ status: 200, message: 'Nenhum resultado encontrado' });
            }

            const lastPage = Math.ceil(count / itens);

            const links = {
                first: `${req.protocol}://${req.hostname}:3000/api/resultados?itens=${itens}&pagina=1&ordem=${ordem}${ano ? `&ano=${ano}` : ''}${municipio ? `&municipio=${municipio}` : ''}`,
                self: `${req.protocol}://${req.hostname}:3000/api/resultados?itens=${itens}&pagina=${pagina}&ordem=${ordem}${ano ? `&ano=${ano}` : ''}${municipio ? `&municipio=${municipio}` : ''}`,
                last: `${req.protocol}://${req.hostname}:3000/api/resultados?itens=${itens}&pagina=${lastPage}&ordem=${ordem}${ano ? `&ano=${ano}` : ''}${municipio ? `&municipio=${municipio}` : ''}`
            };

            return res.status(200).json({ status: 200, message: 'Resultado das eleições', dados: rows, links });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Erro interno do servidor', error: error.message });
        }
    }

    async EleicoesDisputadas(req, res) {
        try {
            const eleicoes = await EleicoesModel.findAll({
                attributes: [
                    'eleicao_ano',
                    'eleicao_tipo',
                    'eleicao_tipo_nome',
                    'eleicao_abrangencia',
                    'eleicao_id'
                ],
                group: ['eleicao_ano', 'eleicao_tipo', 'eleicao_id'],
                order: [['eleicao_ano', 'DESC']]
            });

            if (eleicoes.length === 0) {
                return res.status(200).json({ status: 200, message: 'Nenhuma eleição encontrada' });
            }

            return res.status(200).json({ status: 200, message: 'Eleições disputadas', dados: eleicoes });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Erro interno do servidor', error: error.message });
        }
    }

    async CargosDisputados(req, res) {
        try {
            const eleicoes = await EleicoesModel.findAll({
                attributes: [
                    'eleicao_cargo_nome',
                    'eleicao_cargo_id',
                ],
                group: ['eleicao_cargo_id'],
                order: [['eleicao_ano', 'DESC']]
            });

            if (eleicoes.length === 0) {
                return res.status(200).json({ status: 200, message: 'Nenhuma eleição encontrada' });
            }

            return res.status(200).json({ status: 200, message: 'Cargos disputados', dados: eleicoes });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Erro interno do servidor', error: error.message });
        }
    }

    async SalvarResultados(req, res) {
        try {            
            const primeiraEleicao = parseInt(process.env.PRIMEIRA_ELEICAO, 10);
            const ultimaEleicao = parseInt(process.env.ULTIMA_ELEICAO, 10);

            for (let ano = primeiraEleicao; ano <= ultimaEleicao; ano += 2) {
                const resultados = await this.GetResultadoCSV(ano);

                await EleicoesModel.destroy({
                    where: { eleicao_ano: ano }
                });

                await EleicoesModel.bulkCreate(resultados);
            }

            return res.status(200).json({ status: 200, message: 'Resultados salvos com sucesso' });
        } catch (error) {
            console.error('Erro ao salvar resultados:', error);
            return res.status(500).json({ status: 500, message: 'Erro ao salvar resultados' });
        }
    }

    async GetResultadoCSV(anoEleicao) {
        const resultados = {};
        let totalVotosGeral = 0;

        return new Promise((resolve, reject) => {
            fs.createReadStream(`./src/csv/${anoEleicao}/votacao_candidato_munzona_${anoEleicao}_${process.env.ESTADO_DEPUTADO}.csv`)
                .pipe(iconv.decodeStream('latin1'))
                .pipe(csv({ separator: ';' }))
                .on('data', (data) => {
                    if (data.NM_URNA_CANDIDATO === process.env.NOME_DEPUTADO || data.NM_URNA_CANDIDATO.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase() === process.env.NOME_DEPUTADO.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase()) {
                        const municipioId = data.CD_MUNICIPIO;
                        const votosNominais = parseInt(data.QT_VOTOS_NOMINAIS, 10);

                        let abrangencia = '';

                        if (data.TP_ABRANGENCIA == 'M') {
                            abrangencia = 'Eleições Municipais de ' + anoEleicao
                        } else {
                            abrangencia = 'Eleições Gerais de ' + anoEleicao
                        }

                        totalVotosGeral += votosNominais;

                        if (resultados[municipioId]) {
                            resultados[municipioId].eleicao_total_votos += votosNominais;
                        } else {
                            resultados[municipioId] = {
                                eleicao_tipo: data.CD_TIPO_ELEICAO,
                                eleicao_ano: anoEleicao,
                                eleicao_tipo_nome: data.NM_TIPO_ELEICAO,
                                eleicao_abrangencia: abrangencia,
                                eleicao_id: data.CD_ELEICAO,
                                eleicao_estado_sigla: data.SG_UF,
                                eleicao_municipio_id: data.CD_MUNICIPIO,
                                eleicao_municipio_nome: data.NM_MUNICIPIO,
                                eleicao_cargo_nome: data.DS_CARGO,
                                eleicao_cargo_id: data.CD_CARGO,
                                eleicao_total_votos: votosNominais,
                                eleicao_situacao: data.DS_SIT_TOT_TURNO,
                                eleicao_percentual: 0
                            };
                        }
                    }
                })
                .on('end', () => {
                    Object.values(resultados).forEach((resultado) => {
                        if (totalVotosGeral > 0) {
                            const percentual = (resultado.eleicao_total_votos / totalVotosGeral) * 100;
                            resultado.eleicao_percentual = Math.floor(percentual * 100) / 100;
                        } else {
                            resultado.eleicao_percentual = 0;
                        }
                    });

                    resolve(Object.values(resultados));
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    async SyncModel(req, res) {
        try {
            await EleicoesModel.sync({ alter: true });
            return res.status(200).json({ status: 200, message: 'Modelo sincronizado' });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Erro interno do servidor' });
        }
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





}

module.exports = new EleicoesController();
