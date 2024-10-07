const EleicoesModel = require('../model/EleicoesModel');
const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');

require('dotenv').config();

class EleicoesController {

    constructor() {
        this.SalvarResultados = this.SalvarResultados.bind(this);
        this.GetResultadoCSV = this.GetResultadoCSV.bind(this);
        this.SyncModel = this.SyncModel.bind(this);
    }

    async SalvarResultados(req, res) {
        try {
            const estado = req.query.estado || process.env.ESTADO_DEPUTADO;

            const primeiraEleicao = parseInt(process.env.PRIMEIRA_ELEICAO, 10);
            const ultimaEleicao = parseInt(process.env.ULTIMA_ELEICAO, 10);

            for (let ano = primeiraEleicao; ano <= ultimaEleicao; ano += 2) {
                const resultados = await this.GetResultadoCSV(ano, estado);

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



    async GetResultadoCSV(anoEleicao, estadoEleicao) {
        const resultados = {};
        let totalVotosGeral = 0;

        return new Promise((resolve, reject) => {
            fs.createReadStream(`./src/csv/${anoEleicao}/votacao_candidato_munzona_${anoEleicao}_${estadoEleicao}.csv`)
                .pipe(iconv.decodeStream('latin1'))
                .pipe(csv({ separator: ';' }))
                .on('data', (data) => {
                    if (data.NM_URNA_CANDIDATO === process.env.NOME_DEPUTADO || data.NM_URNA_CANDIDATO.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase() === process.env.NOME_DEPUTADO.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase()) {
                        const municipioId = data.CD_MUNICIPIO;
                        const votosNominais = parseInt(data.QT_VOTOS_NOMINAIS, 10);

                        totalVotosGeral += votosNominais;

                        if (resultados[municipioId]) {
                            resultados[municipioId].eleicao_total_votos += votosNominais;
                        } else {
                            resultados[municipioId] = {
                                eleicao_tipo: data.CD_TIPO_ELEICAO,
                                eleicao_ano: anoEleicao,
                                eleicao_tipo_nome: data.NM_TIPO_ELEICAO,
                                eleicao_id: data.CD_ELEICAO,
                                eleicao_estado_sigla: data.SG_UF,
                                eleicao_municipio_id: data.CD_MUNICIPIO,
                                eleicao_municipio_nome: data.NM_MUNICIPIO,
                                eleicao_cargo_nome: data.DS_CARGO,
                                eleicao_cargo_id: data.CD_CARGO,
                                eleicao_total_votos: votosNominais,
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
}

module.exports = new EleicoesController();
