// Módulo para comunicação via TCP
//@ts-ignore
import * as net from "net";
import { LeituraSensor } from "../modelos/leituraSensor.js"; // Modelo que representa uma leitura do sensor

const port = Number(process.argv[2]) || 3001; // Define a porta e o nome do sensor
const nomeSensor = process.argv[3] || "S1";

// Gera um número aleatório entre mínimo e máximo
function numeroAleatorio(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Gera uma nova leitura a cada requisição
function gerarLeitura(): LeituraSensor {
  const temperatura = Number(numeroAleatorio(20, 35).toFixed(1)); // Temperatura entre 20 e 35 °C
  const umidade = Math.floor(numeroAleatorio(40, 90)); // Umidade entre 40% e 90%
  const incidenciaSolar = Math.floor(numeroAleatorio(300, 1000)); // Incidência solar entre 300 e 1000 W/m²

  return new LeituraSensor(nomeSensor, temperatura, umidade, incidenciaSolar); // Retorna os dados do sensor
}

// Cria o servidor TCP
const server = net.createServer((socket: net.Socket) => {
  console.log(`Gateway conectado ao ${nomeSensor}`);

  // Executado quando o sensor recebe uma requisição
  //@ts-ignore
  socket.on("data", (data: Buffer) => {
    const requisicao = data.toString("utf8"); // Converte os dados recebidos para texto

    console.log(`${nomeSensor} recebeu: ${requisicao}`);

    // Verifica se o Gateway pediu os dados
    if (requisicao === "GET_DATA") {
      const leitura = gerarLeitura(); // Gera uma nova leitura

      console.log("Enviando leitura:");
      console.log(leitura);

      socket.write(JSON.stringify(leitura)); // Envia a leitura para o Gateway em JSON
      socket.end(); // Encerra a conexão
    }
  });

  // Executado quando a conexão é encerrada
  socket.on("close", () => {
    console.log(`Conexão com ${nomeSensor} encerrada.`);
  });
});

// Inicia o servidor na porta definida
server.listen(port, () => {
  console.log(`${nomeSensor} funcionando na porta ${port}`);
});
