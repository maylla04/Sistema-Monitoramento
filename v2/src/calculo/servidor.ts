import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";

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
const servico = pacote.calculo.CalculoService;

function calcularMedias(call: any, callback: any) {
  const leituras = call.request.leituras;

  if (!leituras || leituras.length === 0) {
    callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: "Envie pelo menos uma leitura de sensor.",
    });
    return;
  }

  const quantidade = leituras.length;

  const temperaturaMedia =
    leituras.reduce(
      (soma: number, leitura: any) => soma + leitura.temperatura,
      0,
    ) / quantidade;

  const umidadeMedia =
    leituras.reduce((soma: number, leitura: any) => soma + leitura.umidade, 0) /
    quantidade;

  const incidenciaSolarMedia =
    leituras.reduce(
      (soma: number, leitura: any) => soma + leitura.incidenciaSolar,
      0,
    ) / quantidade;

  const resposta = {
    temperaturaMedia: Number(temperaturaMedia.toFixed(1)),
    umidadeMedia: Number(umidadeMedia.toFixed(1)),
    incidenciaSolarMedia: Number(incidenciaSolarMedia.toFixed(1)),
  };

  console.log("Leituras recebidas:", quantidade);
  console.log("Médias calculadas:", resposta);

  callback(null, resposta);
}

const servidor = new grpc.Server();

servidor.addService(servico.service, {
  calcularMedias,
});

servidor.bindAsync(
  "0.0.0.0:50051",
  grpc.ServerCredentials.createInsecure(),
  (erro, porta) => {
    if (erro) {
      console.error("Erro ao iniciar servidor RPC:", erro);
      return;
    }

    console.log(`Servidor RPC funcionando na porta ${porta}`);
  },
);
