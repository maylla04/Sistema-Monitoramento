//@ts-ignore
import * as net from "net";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { LeituraSensor } from "../modelos/leituraSensor.js";

// Aqui estamos dizendo: O Gateway conhece três conjuntos de sensores.
// O host de cada sensor pode ser definido por variável de ambiente,
// assim cada sensor pode rodar em uma máquina diferente na rede
// (basta exportar SENSOR1_HOST, SENSOR2_HOST, SENSOR3_HOST antes de iniciar o gateway).
const sensores = [
  {
    nome: "S1",
    host: process.env.SENSOR1_HOST || "localhost",
    port: 3001,
  },
  {
    nome: "S2",
    host: process.env.SENSOR2_HOST || "localhost",
    port: 3002,
  },
  {
    nome: "S3",
    host: process.env.SENSOR3_HOST || "localhost",
    port: 3003,
  },
];

// O serviço de cálculo de média agora roda em outra máquina.
// Configure MEDIA_HOST e MEDIA_PORT antes de iniciar o gateway.
const mediaService = {
  host: process.env.MEDIA_HOST || "localhost",
  port: Number(process.env.MEDIA_PORT) || 4000,
};

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

// Consulta o serviço remoto de média, enviando as leituras coletadas
// e recebendo o resultado já calculado
function consultarMedia(leituras: LeituraSensor[]): Promise<{
  temperaturaMedia: number;
  umidadeMedia: number;
  incidenciaSolarMedia: number;
}> {
  return new Promise((resolve, reject) => {
    // Cria a conexão TCP com o serviço de média
    const client: net.Socket = net.createConnection({
      host: mediaService.host,
      port: mediaService.port,
    });

    // Guarda os dados recebidos do serviço de média
    let dadosRecebidos = "";

    // Executado quando a conexão é estabelecida
    client.on("connect", () => {
      console.log(
        `Conectado ao serviço de média em ${mediaService.host}:${mediaService.port}`,
      );

      // Envia as leituras como JSON e já encerra o lado de escrita,
      // sinalizando ao servidor que terminou de enviar
      client.end(JSON.stringify(leituras));
    });

    // Executado quando chegam dados do serviço de média
    //@ts-ignore
    client.on("data", (data: Buffer) => {
      dadosRecebidos += data.toString("utf8");
    });

    // Executado quando o serviço de média termina o envio
    client.on("end", () => {
      try {
        const medias = JSON.parse(dadosRecebidos);

        resolve(medias);
      } catch (erro) {
        reject(erro);
      }
    });

    // Captura erros na conexão
    client.on("error", (erro) => {
      reject(erro);
    });
  });
}

// Agora vamos consultar todos os sensores
async function coletarDados() {
  console.log("\n==============================");
  console.log("INICIANDO COLETA DE DADOS");
  console.log("==============================");

  try {
    const leituras: LeituraSensor[] = [];

    for (const sensor of sensores) {
      const leitura = await consultarSensor(sensor.host, sensor.port);

      leituras.push(leitura);

      console.log(
        `${sensor.nome}: temperatura=${leitura.temperatura}°C | ` +
          `umidade=${leitura.umidade}% | ` +
          `solar=${leitura.incidenciaSolar} W/m²`,
      );
    }

    // Em vez de calcular localmente, consulta o serviço remoto de média
    const medias = await consultarMedia(leituras);

    historico.push({
      data: new Date().toISOString(),
      temperaturaMedia: medias.temperaturaMedia,
      umidadeMedia: medias.umidadeMedia,
      incidenciaSolarMedia: medias.incidenciaSolarMedia,
    });
  } catch (erro) {
    console.error("Erro ao consultar sensores ou serviço de média:", erro);
  }
}
coletarDados();

// Cria um servidor HTTP para a interface
const httpServer = http.createServer((req, res) => {
  // Rota que fornece os dados do histórico
  if (req.url === "/api/dados") {
    // Define que a resposta será um JSON
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });

    // Envia o histórico para a interface
    res.end(JSON.stringify(historico));

    return;
  }

  // Rota para pedir uma nova leitura dos sensores sob demanda
  if (req.url === "/api/coletar" && req.method === "POST") {
    coletarDados().then(() => {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });

      res.end(JSON.stringify({ ok: true }));
    });

    return;
  }

  // Rota principal que abre a interface
  if (req.url === "/" || req.url === "/index.html") {
    // Monta o caminho até o arquivo HTML
    const arquivo = path.join(process.cwd(), "src", "interface", "index.html");

    // Lê o arquivo HTML
    fs.readFile(arquivo, (erro, conteudo) => {
      // Verifica se ocorreu algum erro
      if (erro) {
        res.writeHead(500);

        res.end("Erro ao carregar interface");

        return;
      }

      // Define que a resposta será uma página HTML
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
      });

      // Envia o HTML para o navegador
      res.end(conteudo);
    });

    return;
  }

  // Caso a rota não exista, retorna erro 404
  res.writeHead(404);

  res.end("Página não encontrada");
});

// Inicia o servidor HTTP na porta 8080
// "0.0.0.0" garante que a interface fique acessível de outras máquinas da rede,
// não só do próprio localhost
httpServer.listen(8080, "0.0.0.0", () => {
  console.log("Interface disponível em http://localhost:8080");
});
