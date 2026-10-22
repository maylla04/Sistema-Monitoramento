import * as net from "net";
import * as path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";


// Os Edges que o FOG consulta por socket.
// O host pode ser definido por variável de ambiente (EDGE1_HOST, EDGE2_HOST),
// assim cada Edge pode estar em uma máquina diferente.
const edges = [
  {
    nome: "EDGE1",
    host: process.env.EDGE1_HOST || "localhost",
    port: 4001,
  },
  {
    nome: "EDGE2",
    host: process.env.EDGE2_HOST || "localhost",
    port: 4002,
  },
];

// Intervalo entre uma coleta e a próxima (em milissegundos)
const INTERVALO = 5000;

// Cliente gRPC do microserviço de análise de anomalias
const anomaliasHost = process.env.ANOMALIAS_HOST || "localhost";
const anomaliasPort = Number(process.env.ANOMALIAS_PORT) || 50052;

const caminhoProto = path.join(
  process.cwd(),
  "src",
  "anomalias",
  "analiseAnomalias.proto",
);

const definicao = protoLoader.loadSync(caminhoProto, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const pacote = grpc.loadPackageDefinition(definicao) as any;

const clienteAnomalias = new pacote.anomalias.AnomaliaService(
  `${anomaliasHost}:${anomaliasPort}`,
  grpc.credentials.createInsecure(),
);

type MediaEdge = {
  edge: string;
  data?: string;
  temperaturaMedia?: number;
  umidadeMedia?: number;
  incidenciaSolarMedia?: number;
  semDados?: boolean;
};

type Anomalia = {
  edge: string;
  tipo: string;
  mensagem: string;
  acao: string;
};

// Histórico de anomalias detectadas pelo FOG
const historicoAnomalias: (Anomalia & { data: string })[] = [];

// Consulta um Edge por socket e retorna a última média dele
function consultarEdge(host: string, port: number): Promise<MediaEdge> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host, port });
    let dadosRecebidos = "";

    // Se o Edge não responder em 3 segundos, desiste
    client.setTimeout(3000, () => {
      client.destroy(new Error("tempo esgotado"));
    });

    client.on("connect", () => {
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

// Envia as médias dos Edges ao microserviço de anomalias (RPC)
function analisarAnomalias(
  medicoes: {
    edge: string;
    temperaturaMedia: number;
    umidadeMedia: number;
    incidenciaSolarMedia: number;
  }[],
): Promise<Anomalia[]> {
  return new Promise((resolve, reject) => {
    clienteAnomalias.analisarAnomalias(
      { medicoes },
      (erro: grpc.ServiceError | null, resposta: any) => {
        if (erro) {
          reject(erro);
          return;
        }

        resolve(resposta.anomalias);
      },
    );
  });
}

// Gatilhos: aqui o FOG reage à anomalia (por enquanto só simula no console)
function acionarGatilho(anomalia: Anomalia) {
  switch (anomalia.acao) {
    case "LIGAR_IRRIGACAO":
      console.log(`[GATILHO] Irrigação LIGADA no ${anomalia.edge}`);
      break;
    case "LIGAR_VENTILACAO":
      console.log(`[GATILHO] Ventilação LIGADA no ${anomalia.edge}`);
      break;
    case "ACIONAR_SOMBREAMENTO":
      console.log(`[GATILHO] Sombreamento ACIONADO no ${anomalia.edge}`);
      break;
    default:
      console.log(`[GATILHO] Ação desconhecida: ${anomalia.acao}`);
  }
}

async function coletarDados() {
  console.log("\n==============================");
  console.log("FOG: INICIANDO COLETA NOS EDGES");
  console.log("==============================");

  // allSettled: se um Edge cair, os outros continuam sendo lidos
  const resultados = await Promise.allSettled(
    edges.map((edge) => consultarEdge(edge.host, edge.port)),
  );

  const medicoes: {
    edge: string;
    temperaturaMedia: number;
    umidadeMedia: number;
    incidenciaSolarMedia: number;
  }[] = [];

  resultados.forEach((resultado, i) => {
    const nome = edges[i].nome;

    if (resultado.status === "rejected") {
      console.error(`${nome} indisponível:`, resultado.reason?.message);
      return;
    }

    const media = resultado.value;

    if (media.semDados) {
      console.log(`${nome}: ainda sem dados`);
      return;
    }

    console.log(
      `${nome}: temperatura=${media.temperaturaMedia}°C | ` +
        `umidade=${media.umidadeMedia}% | ` +
        `solar=${media.incidenciaSolarMedia} W/m²`,
    );
    medicoes.push({
      edge: nome,
      temperaturaMedia: media.temperaturaMedia!,
      umidadeMedia: media.umidadeMedia!,
      incidenciaSolarMedia: media.incidenciaSolarMedia!,
    });
});
  if (medicoes.length === 0) {
    return;
  }

  try {
    const anomalias = await analisarAnomalias(medicoes);

    if (anomalias.length === 0) {
      console.log("Nenhuma anomalia detectada.");
      return;
    }

    for (const anomalia of anomalias) {
      console.log(`ANOMALIA em ${anomalia.edge}: ${anomalia.mensagem}`);

      historicoAnomalias.push({
        ...anomalia,
        data: new Date().toISOString(),
      });

      acionarGatilho(anomalia);
    }
  } catch (erro) {
    console.error("Erro ao consultar o serviço de anomalias:", erro);
  }
}

// Repete a coleta; o próximo ciclo só começa quando o anterior terminar
async function iniciar() {
  await coletarDados();
  setTimeout(iniciar, INTERVALO);
}

console.log("FOG iniciado");
iniciar();