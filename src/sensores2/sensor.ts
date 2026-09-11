// Módulo para comunicação via TCP
//@ts-ignore
import * as net from "net";

// Modelo que representa uma leitura do sensor
import { LeituraSensor } from "../modelos/leituraSensor.js";

// Define a porta e o nome do sensor
const port = Number(process.argv[2]) || 3001;
const nomeSensor = process.argv[3] || "S1";

// Gera um número aleatório entre mínimo e máximo
function numeroAleatorio(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Gera uma nova leitura a cada requisição
function gerarLeitura(): LeituraSensor {
  // Temperatura entre 20 e 35 °C
  const temperatura = Number(numeroAleatorio(20, 35).toFixed(1));

  // Umidade entre 40% e 90%
  const umidade = Math.floor(numeroAleatorio(40, 90));

  // Incidência solar entre 300 e 1000 W/m²
  const incidenciaSolar = Math.floor(numeroAleatorio(300, 1000));

  // Retorna os dados do sensor
  return new LeituraSensor(nomeSensor, temperatura, umidade, incidenciaSolar);
}

// Cria o servidor TCP
const server = net.createServer((socket: net.Socket) => {
  console.log(`Gateway conectado ao ${nomeSensor}`);

  // Executado quando o sensor recebe uma requisição
  //@ts-ignore
  socket.on("data", (data: Buffer) => {
    // Converte os dados recebidos para texto
    const requisicao = data.toString("utf8");

    console.log(`${nomeSensor} recebeu: ${requisicao}`);

    // Verifica se o Gateway pediu os dados
    if (requisicao === "GET_DATA") {
      // Gera uma nova leitura
      const leitura = gerarLeitura();

      console.log("Enviando leitura:");
      console.log(leitura);

      // Envia a leitura para o Gateway em JSON
      socket.write(JSON.stringify(leitura));

      // Encerra a conexão
      socket.end();
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
