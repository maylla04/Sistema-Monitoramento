import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";

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
const servico = pacote.anomalias.AnomaliaService;

// Limites que definem o que é uma anomalia (ajuste como quiser)
const LIMITES = {
  umidadeMinima: 55,
  temperaturaMaxima: 30,
  incidenciaSolarMaxima: 850,
};

function analisarAnomalias(call: any, callback: any) {
  const medicoes = call.request.medicoes;

  if (!medicoes || medicoes.length === 0) {
    callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: "Envie pelo menos uma medição.",
    });
    return;
  }

  const anomalias: {
    edge: string;
    tipo: string;
    mensagem: string;
    acao: string;
  }[] = [];

  for (const medicao of medicoes) {
    if (medicao.umidadeMedia < LIMITES.umidadeMinima) {
      anomalias.push({
        edge: medicao.edge,
        tipo: "UMIDADE_BAIXA",
        mensagem: `Umidade em ${medicao.umidadeMedia}% (mínimo ${LIMITES.umidadeMinima}%)`,
        acao: "LIGAR_IRRIGACAO",
      });
    }

    if (medicao.temperaturaMedia > LIMITES.temperaturaMaxima) {
      anomalias.push({
        edge: medicao.edge,
        tipo: "TEMPERATURA_ALTA",
        mensagem: `Temperatura em ${medicao.temperaturaMedia}°C (máximo ${LIMITES.temperaturaMaxima}°C)`,
        acao: "LIGAR_VENTILACAO",
      });
    }

    if (medicao.incidenciaSolarMedia > LIMITES.incidenciaSolarMaxima) {
      anomalias.push({
        edge: medicao.edge,
        tipo: "RADIACAO_ALTA",
        mensagem: `Incidência solar em ${medicao.incidenciaSolarMedia} W/m² (máximo ${LIMITES.incidenciaSolarMaxima} W/m²)`,
        acao: "ACIONAR_SOMBREAMENTO",
      });
    }
  }

  console.log(
    `Medições recebidas: ${medicoes.length} | Anomalias encontradas: ${anomalias.length}`,
  );

  callback(null, { anomalias });
}


const servidor = new grpc.Server();

servidor.addService(servico.service, {
  analisarAnomalias,
});

servidor.bindAsync(
  "0.0.0.0:50052",
  grpc.ServerCredentials.createInsecure(),
  (erro, porta) => {
    if (erro) {
      console.error("Erro ao iniciar servidor de anomalias:", erro);
      return;
    }

    console.log(`Servidor RPC de anomalias funcionando na porta ${porta}`);
  },
);