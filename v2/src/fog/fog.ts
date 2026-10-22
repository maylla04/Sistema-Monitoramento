import * as net from "net";

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

type MediaEdge = {
  edge: string;
  data?: string;
  temperaturaMedia?: number;
  umidadeMedia?: number;
  incidenciaSolarMedia?: number;
  semDados?: boolean;
};

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

async function coletarDados() {
  console.log("\n==============================");
  console.log("FOG: INICIANDO COLETA NOS EDGES");
  console.log("==============================");

  // allSettled: se um Edge cair, os outros continuam sendo lidos
  const resultados = await Promise.allSettled(
    edges.map((edge) => consultarEdge(edge.host, edge.port)),
  );

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
  });
}

// Repete a coleta; o próximo ciclo só começa quando o anterior terminar
async function iniciar() {
  await coletarDados();
  setTimeout(iniciar, INTERVALO);
}

console.log("FOG iniciado");
iniciar();