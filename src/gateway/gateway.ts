//@ts-ignore
import * as net from "net";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { LeituraSensor } from "../modelos/leituraSensor.js";

//Aqui estamos dizendo: O Gateway conhece três conjuntos de sensores.
const sensores = [
  {
    nome: "S1",
    host: "localhost",
    port: 3001,
  },
  {
    nome: "S2",
    host: "localhost",
    port: 3002,
  },
  {
    nome: "S3",
    host: "localhost",
    port: 3003,
  },
];

const historico: {
  data: string;
  umidadeMedia: number;
  temperaturaMedia: number;
  incidenciaSolarMedia: number;
}[] = [];

// Consulta um sensor e retorna sua leitura
function consultarSensor(host: string, port: number): Promise<LeituraSensor> {
  // Cria uma Promise para esperar a resposta do sensor
  return new Promise((resolve, reject) => {
    // Cria a conexão TCP com o sensor
    const client: net.Socket = net.createConnection({
      host,
      port,
    });

    // Guarda os dados recebidos do sensor
    let dadosRecebidos = "";

    // Executado quando a conexão é estabelecida
    client.on("connect", () => {
      console.log(`Conectado ao sensor ${port}`);

      // Envia a requisição para o sensor
      client.write("GET_DATA");
    });

    // Executado quando chegam dados do sensor
    //@ts-ignore
    client.on("data", (data: Buffer) => {
      // Converte os dados para texto e armazena
      dadosRecebidos += data.toString("utf8");
    });

    // Executado quando o sensor termina o envio
    client.on("end", () => {
      try {
        // Converte o JSON recebido em objeto
        const leitura = JSON.parse(dadosRecebidos);

        // Retorna a leitura para quem chamou a função
        resolve(leitura);
      } catch (erro) {
        // Informa que ocorreu um erro
        reject(erro);
      }
    });

    // Captura erros na conexão
    client.on("error", (erro) => {
      reject(erro);
    });
  });
}
