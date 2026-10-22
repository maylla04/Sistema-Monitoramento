import * as net from "net";
import * as path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { LeituraSensor } from "../modelos/leituraSensor.js";

// Sensores do segundo Edge
const sensores = [
  {
    nome: "S4",
    host: process.env.SENSOR4_HOST || "localhost",
    port: 3004,
  },
  {
    nome: "S5",
    host: process.env.SENSOR5_HOST || "localhost",
    port: 3005,
  },
  {
    nome: "S6",
    host: process.env.SENSOR6_HOST || "localhost",
    port: 3006,
  },
];

// Endereço do microserviço RPC compartilhado
const mediaHost = process.env.MEDIA_HOST || "localhost";
const mediaPort = Number(process.env.MEDIA_PORT) || 50051;

// Carrega a definição do serviço RPC já existente
const caminhoProto = path.join(
  process.cwd(),
  "src",
  "calculo",
  "calcularMedia.proto",
);

const definicao = protoLoader.loadSync(caminhoProto, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const pacote = grpc.loadPackageDefinition(definicao) as any;

const clienteRPC = new pacote.calculo.CalculoService(
  `${mediaHost}:${mediaPort}`,
  grpc.credentials.createInsecure(),
);

const historico: {
  data: string;
  umidadeMedia: number;
  temperaturaMedia: number;
  incidenciaSolarMedia: number;
}[] = [];

const edgeNome = "EDGE2";
const edgePort = 4002;

const edgeServer = net.createServer((socket: net.Socket) => {
  socket.on("data", (data: Buffer) => {
    if (data.toString("utf8").trim() !== "GET_DATA") {
      return;
    }

    const ultimo = historico[historico.length - 1];

    const resposta = ultimo
      ? { edge: edgeNome, ...ultimo }
      : { edge: edgeNome, semDados: true };

    socket.write(JSON.stringify(resposta));
    socket.end();
  });

  socket.on("error", () => {});
});

edgeServer.listen(edgePort, "0.0.0.0", () => {
  console.log(`${edgeNome} aguardando o FOG na porta ${edgePort}`);
});

// Consulta um sensor por TCP
function consultarSensor(host: string, port: number): Promise<LeituraSensor> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host, port });
    let dadosRecebidos = "";

    client.on("connect", () => {
      console.log(`Conectado ao sensor na porta ${port}`);
      client.write("GET_DATA");
    });

    client.on("data", (data: Buffer) => {
      dadosRecebidos += data.toString("utf8");
    });

    client.on("end", () => {
      try {
        resolve(JSON.parse(dadosRecebidos));
      } catch (erro) {
        reject(erro);
      }
    });

    client.on("error", (erro) => {
      reject(erro);
    });
  });
}

// Envia as leituras ao microserviço RPC
function consultarMedia(leituras: LeituraSensor[]): Promise<{
  temperaturaMedia: number;
  umidadeMedia: number;
  incidenciaSolarMedia: number;
}> {
  return new Promise((resolve, reject) => {
    clienteRPC.calcularMedias(
      { leituras },
      (erro: grpc.ServiceError | null, medias: any) => {
        if (erro) {
          reject(erro);
          return;
        }

        resolve(medias);
      },
    );
  });
}

// Coleta os dados do segundo Edge

async function coletarDados() {
  console.log("\n==============================");
  console.log("INICIANDO SEGUNDO GATEWAY");
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

    const medias = await consultarMedia(leituras);

    console.log("Médias do segundo Edge recebidas pelo RPC:");
    console.log(medias);

    historico.push({
      data: new Date().toISOString(),
      temperaturaMedia: medias.temperaturaMedia,
      umidadeMedia: medias.umidadeMedia,
      incidenciaSolarMedia: medias.incidenciaSolarMedia,
    });
  } catch (erro) {
    console.error(
      "Erro no segundo Gateway ao consultar sensores ou RPC:",
      erro,
    );
  }
}

coletarDados();
setInterval(() => {
  coletarDados();
}, 5000);
